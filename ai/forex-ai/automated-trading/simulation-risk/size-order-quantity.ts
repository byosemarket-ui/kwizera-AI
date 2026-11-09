/**
 * Phase 56.2.5 / Stage 1 Part 1–2 — Pure order quantity sizing from individual order allocation.
 *
 * Part 2: size in application LOTS (pipCost/mmr per lot), then convert to FXCM integer AMOUNT
 * via amount = baseUnitSize × lots. Broker min/step/max live in AMOUNT space.
 * Never invents margin, pip value, units, or stop distances. Never rounds quantity upward.
 */

import {
  computeAllowedRiskAmount,
  computePerOrderLossLimit,
  computePerOrderRiskTarget,
} from "./capital-budget.js";
import {
  ensureAmountInAccountCurrency,
  type ConversionRateSnapshot,
} from "./currency-conversion.js";
import {
  amountConstraintsToLots,
  lotsToFxcmAmount,
} from "./fxcm-amount-lots.js";
import {
  floorQuantityToStep,
  resolveXauQuantityConstraints,
  type QuantityConstraintsResult,
} from "./quantity-constraints.js";
import type { AtSimContractMetaInput } from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export type SizeOrderQuantityResult =
  | {
    ok: true;
    /** Application lots (risk/margin unit). */
    quantity: number;
    quantityUnit: "contracts";
    /** ForexConnect AMOUNT = baseUnitSize × lots (integer). */
    brokerAmount: number;
    baseUnitSize: number;
    estimatedStopLossRisk: number;
    /** Hard 25% ceiling. */
    maxPermittedOrderLoss: number;
    /** 25% risk target amount (v3). */
    riskTargetAmount: number;
    /** min(target, hardMax) — sizing ceiling (= 25% under v3). */
    allowedRiskAmount: number;
    /** Monetary SL risk per 1.0 lot. */
    riskPerUnit: number;
    requiredMargin: number | null;
    freeMargin: number | null;
    remainingStrategyBudgetAfter: number;
    constraints: QuantityConstraintsResult;
    method: "POINT_COST" | "CONTRACT_MULTIPLIER";
    notes: string[];
  }
  | {
    ok: false;
    quantity: null;
    brokerAmount: null;
    quantityUnit: "contracts" | "unknown" | null;
    code: string;
    message: string;
    constraints: QuantityConstraintsResult | null;
    notes: string[];
  };

export interface SizeOrderQuantityInput {
  /** Verified account equity (account currency). */
  verifiedEquity: number | null | undefined;
  accountCurrency: string | null | undefined;
  strategyAllocationPercent: number | null | undefined;
  remainingStrategyBudget: number | null | undefined;
  /** User individual order allocation (same currency as equity when USD). */
  individualOrderAllocation: number | null | undefined;
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
  /** Verified free/usable margin when available. */
  freeMargin: number | null | undefined;
  /** When false/null, exposure not established — block. */
  exposureAuthoritative: boolean | null | undefined;
  /** Absolute margin for 1 contract/lot in account currency when verified. */
  marginPerUnitAccount?: number | null;
  /** Distinct SDK min when available (preferred over legacy lotStep). */
  sdkMinQuantity?: number | null;
  legacyLotStep?: number | null;
  /** Broker-reported maximum AMOUNT when supplied (never invented). */
  brokerMaxQuantity?: number | null;
  /**
   * Currency of individualOrderAllocation (UI currently labels USD).
   * Converted into accountCurrency when they differ — requires rateSnapshot.
   */
  allocationCurrency?: string | null;
  conversionRateSnapshot?: ConversionRateSnapshot | null;
  nowMs?: number;
}

function fail(
  code: string,
  message: string,
  notes: string[],
  constraints: QuantityConstraintsResult | null = null,
  quantityUnit: "contracts" | "unknown" | null = "contracts",
): SizeOrderQuantityResult {
  return {
    ok: false,
    quantity: null,
    brokerAmount: null,
    quantityUnit,
    code,
    message,
    constraints,
    notes,
  };
}

/**
 * Derive permissible quantity from individual order allocation under verified FXCM constraints.
 * Sizes in lots; returns integer broker AMOUNT separately.
 */
export function sizeOrderQuantityFromAllocation(
  input: SizeOrderQuantityInput,
): SizeOrderQuantityResult {
  const notes: string[] = [];
  const c = input.contract;

  if (!c?.verified) {
    return fail(
      "SIZE_QTY_CONTRACT_UNVERIFIED",
      "Contract metadata unverified — quantity not invented.",
      notes,
      null,
      null,
    );
  }
  if (c.quantityUnitAmbiguous || c.quantityUnit !== "contracts") {
    return fail(
      "SIZE_QTY_UNIT_AMBIGUOUS",
      "Quantity unit ambiguous — monetary sizing blocked.",
      notes,
      null,
      c.quantityUnit === "contracts" ? "contracts" : "unknown",
    );
  }

  if (!finitePositive(input.verifiedEquity)) {
    return fail(
      "SIZE_QTY_EQUITY_UNVERIFIED",
      "Verified equity required for allocation-aware sizing.",
      notes,
    );
  }
  const ccy = String(input.accountCurrency ?? "").trim().toUpperCase();
  if (!ccy) {
    return fail(
      "SIZE_QTY_ACCOUNT_CURRENCY_MISSING",
      "Account currency unverified — conversion not invented.",
      notes,
    );
  }

  if (
    !finitePositive(input.strategyAllocationPercent)
    || input.strategyAllocationPercent < 1
    || input.strategyAllocationPercent > 100
  ) {
    return fail(
      "SIZE_QTY_STRATEGY_PCT_INVALID",
      "Strategy allocation percent must be a verified value in 1–100.",
      notes,
    );
  }

  if (!finiteNonNeg(input.remainingStrategyBudget)) {
    return fail(
      "SIZE_QTY_REMAINING_BUDGET_UNVERIFIED",
      "Remaining strategy budget unverified — sizing blocked.",
      notes,
    );
  }

  if (!finitePositive(input.individualOrderAllocation)) {
    return fail(
      "SIZE_QTY_ORDER_ALLOCATION_INVALID",
      "Individual order allocation must be a finite positive amount.",
      notes,
    );
  }

  const allocCcy = String(input.allocationCurrency ?? "USD").trim().toUpperCase() || "USD";
  const convertedAlloc = ensureAmountInAccountCurrency({
    amount: input.individualOrderAllocation,
    amountCurrency: allocCcy,
    accountCurrency: ccy,
    rateSnapshot: input.conversionRateSnapshot,
    nowMs: input.nowMs,
  });
  if (!convertedAlloc.ok) {
    return fail(convertedAlloc.code, convertedAlloc.message, notes);
  }
  const orderAllocationAccountCcy = convertedAlloc.amount;
  if (!convertedAlloc.identity) {
    notes.push(
      `Order allocation converted ${allocCcy}→${ccy} via ${convertedAlloc.source} `
        + `(age ${convertedAlloc.ageMs}ms; direction=${convertedAlloc.direction}).`,
    );
  }

  if (orderAllocationAccountCcy > input.remainingStrategyBudget + 1e-9) {
    return fail(
      "SIZE_QTY_EXCEEDS_REMAINING_BUDGET",
      "Order allocation (account currency) exceeds remaining strategy budget.",
      notes,
    );
  }

  if (input.exposureAuthoritative !== true) {
    return fail(
      "SIZE_QTY_EXPOSURE_UNVERIFIED",
      "Orders/Trades exposure not authoritative — sizing fail-closed.",
      notes,
    );
  }

  if (!finitePositive(input.entryPrice) || !finitePositive(input.stopLoss)) {
    return fail(
      "SIZE_QTY_PRICES_MISSING",
      "Entry and Stop Loss required to size quantity from risk ceiling.",
      notes,
    );
  }

  const move = Math.abs(input.entryPrice - input.stopLoss);
  if (!(move > 0)) {
    return fail(
      "SIZE_QTY_ZERO_STOP_DISTANCE",
      "Stop distance is zero — cannot size quantity.",
      notes,
    );
  }

  // AMOUNT-space constraints from TradingSettings (min/step = contracts/amount units).
  const constraints = resolveXauQuantityConstraints({
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    baseUnitSize: c.baseUnitSize,
    sdkMinQuantity: input.sdkMinQuantity,
    legacyLotStep: input.legacyLotStep ?? c.quantityStep,
    reportedQuantityStep: c.quantityStep,
    reportedQuantityMin: c.quantityMin,
  });

  if (constraints.sizingBlocked || !finitePositive(constraints.quantityMin) || !finitePositive(constraints.quantityStep)) {
    return fail(
      constraints.blockCode ?? "SIZE_QTY_CONSTRAINTS_BLOCKED",
      constraints.blockMessage ?? "Quantity min/step constraints blocked sizing.",
      [...notes, ...constraints.notes],
      constraints,
    );
  }

  const lotsSpace = amountConstraintsToLots({
    baseUnitSize: c.baseUnitSize,
    amountMin: constraints.quantityMin,
    amountStep: constraints.quantityStep,
    amountMax: input.brokerMaxQuantity,
  });
  if (!lotsSpace.ok) {
    return fail(lotsSpace.code, lotsSpace.message, [...notes, ...lotsSpace.notes], constraints);
  }
  notes.push(...lotsSpace.notes);
  const { lotsMin, lotsStep, lotsMax, baseUnitSize, amountMin } = lotsSpace.lots;

  // pipCost / contract multiplier are per 1.0 lot — not per AMOUNT unit.
  let riskPerLot: number | null = null;
  let method: "POINT_COST" | "CONTRACT_MULTIPLIER" | null = null;
  if (finitePositive(c.pipCostAccount) && finitePositive(c.pointSize)) {
    riskPerLot = (move / c.pointSize) * c.pipCostAccount;
    method = "POINT_COST";
  } else if (finitePositive(c.contractMultiplier)) {
    riskPerLot = move * c.contractMultiplier;
    method = "CONTRACT_MULTIPLIER";
  }
  if (riskPerLot == null || !(riskPerLot > 0) || method == null) {
    return fail(
      "SIZE_QTY_RISK_PER_UNIT_UNVERIFIED",
      "No verified pip/point cost or contract multiplier for monetary SL risk.",
      notes,
      constraints,
    );
  }

  const riskTargetAmount = computePerOrderRiskTarget(orderAllocationAccountCcy);
  const maxPermittedOrderLoss = computePerOrderLossLimit(orderAllocationAccountCcy);
  const allowedRiskAmount = computeAllowedRiskAmount(orderAllocationAccountCcy);
  // Size to the allowed risk (25% target under v3). Never round upward to meet broker min.
  const rawLots = allowedRiskAmount / riskPerLot;
  let quantity = floorQuantityToStep(rawLots, lotsStep, lotsMin);
  if (quantity == null) {
    return fail(
      "SIZE_QTY_BELOW_MIN_AFTER_FLOOR",
      `Allowed risk $${allowedRiskAmount} (target ${riskTargetAmount}, hard max ${maxPermittedOrderLoss}) `
        + `cannot fund minimum ${lotsMin} lots (broker AMOUNT min ${amountMin}, baseUnitSize ${baseUnitSize}) `
        + `after flooring to lots step ${lotsStep}. `
        + "Broker minimum is not satisfied by increasing size beyond the per-order risk budget.",
      notes,
      constraints,
    );
  }

  if (lotsMax != null && quantity > lotsMax + 1e-12) {
    const capped = floorQuantityToStep(lotsMax, lotsStep, lotsMin);
    if (capped == null) {
      return fail(
        "SIZE_QTY_BROKER_MAX_INCOMPATIBLE",
        `Broker maximum AMOUNT maps to lotsMax=${lotsMax} incompatible with lotsMin=${lotsMin}/lotsStep=${lotsStep}.`,
        notes,
        constraints,
      );
    }
    quantity = capped;
    notes.push(`Quantity floored to broker maximum lots ${lotsMax} (from AMOUNT max).`);
  }

  const estimatedStopLossRisk = riskPerLot * quantity;
  if (estimatedStopLossRisk > maxPermittedOrderLoss + 1e-8) {
    return fail(
      "SIZE_QTY_EXCEEDS_LOSS_LIMIT",
      "Floored quantity would exceed hard maximum 25% per-order loss — blocked.",
      notes,
      constraints,
    );
  }
  if (estimatedStopLossRisk > allowedRiskAmount + 1e-8) {
    return fail(
      "SIZE_QTY_EXCEEDS_RISK_TARGET",
      "Floored quantity exceeds 25% risk target — blocked. "
        + "Quantity is not increased to satisfy broker minimums.",
      notes,
      constraints,
    );
  }

  const amountConv = lotsToFxcmAmount({
    lots: quantity,
    baseUnitSize,
    amountMin,
  });
  if (!amountConv.ok || amountConv.amount == null) {
    return fail(
      amountConv.code === "AMOUNT_NOT_INTEGER"
        ? "SIZE_QTY_AMOUNT_NOT_INTEGER"
        : amountConv.code === "AMOUNT_BELOW_MIN_QUANTITY"
          ? "SIZE_QTY_BELOW_MIN_AFTER_FLOOR"
          : "SIZE_QTY_AMOUNT_CONVERSION_FAILED",
      amountConv.message,
      notes,
      constraints,
    );
  }
  notes.push(amountConv.message);

  const marginPer =
    finitePositive(input.marginPerUnitAccount)
      ? input.marginPerUnitAccount
      : finitePositive(c.marginPerLotAccount)
        ? c.marginPerLotAccount
        : null;

  let requiredMargin: number | null = null;
  if (marginPer != null) {
    requiredMargin = marginPer * quantity;
    notes.push("Required margin = marginPerLot × lots (application-estimated from broker MMR when present).");
  } else {
    notes.push("Required margin UNAVAILABLE — marginPerLot unverified; quantity still risk-sized.");
  }

  const freeMargin = finiteNonNeg(input.freeMargin) ? input.freeMargin : null;
  if (requiredMargin != null) {
    if (freeMargin == null) {
      return fail(
        "SIZE_QTY_FREE_MARGIN_UNVERIFIED",
        "Required margin computed but free margin unverified — sizing blocked.",
        notes,
        constraints,
      );
    }
    if (requiredMargin > freeMargin + 1e-8) {
      let fit = quantity;
      while (fit >= lotsMin - 1e-12) {
        const need = marginPer! * fit;
        if (need <= freeMargin + 1e-8) {
          const refitRisk = riskPerLot * fit;
          if (
            refitRisk <= allowedRiskAmount + 1e-8
            && refitRisk <= maxPermittedOrderLoss + 1e-8
          ) {
            const refitAmount = lotsToFxcmAmount({
              lots: fit,
              baseUnitSize,
              amountMin,
            });
            if (!refitAmount.ok || refitAmount.amount == null) {
              return fail(
                "SIZE_QTY_AMOUNT_CONVERSION_FAILED",
                refitAmount.message,
                [...notes, "Margin refit produced non-convertible lots."],
                constraints,
              );
            }
            return {
              ok: true,
              quantity: fit,
              quantityUnit: "contracts",
              brokerAmount: refitAmount.amount,
              baseUnitSize,
              estimatedStopLossRisk: refitRisk,
              maxPermittedOrderLoss,
              riskTargetAmount,
              allowedRiskAmount,
              riskPerUnit: riskPerLot,
              requiredMargin: need,
              freeMargin,
              remainingStrategyBudgetAfter:
                input.remainingStrategyBudget - orderAllocationAccountCcy,
              constraints,
              method,
              notes: [
                ...notes,
                refitAmount.message,
                "Quantity reduced to fit verified free margin without rounding up.",
              ],
            };
          }
        }
        fit = Math.round((fit - lotsStep) / lotsStep) * lotsStep;
      }
      return fail(
        "SIZE_QTY_INSUFFICIENT_FREE_MARGIN",
        "Verified free margin cannot support minimum quantity under risk ceiling.",
        notes,
        constraints,
      );
    }
  } else if (freeMargin == null) {
    notes.push("Free margin not supplied — margin gate skipped (margin metadata also missing).");
  }

  return {
    ok: true,
    quantity,
    quantityUnit: "contracts",
    brokerAmount: amountConv.amount,
    baseUnitSize,
    estimatedStopLossRisk,
    maxPermittedOrderLoss,
    riskTargetAmount,
    allowedRiskAmount,
    riskPerUnit: riskPerLot,
    requiredMargin,
    freeMargin,
    remainingStrategyBudgetAfter:
      input.remainingStrategyBudget - orderAllocationAccountCcy,
    constraints,
    method,
    notes,
  };
}
