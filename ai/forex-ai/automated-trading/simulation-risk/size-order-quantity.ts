/**
 * Phase 56.2.5 — Pure XAU/USD order quantity sizing from individual order allocation.
 * Simulation-only. Never invents margin, pip value, units, or stop distances.
 */

import { computePerOrderLossLimit } from "./capital-budget.js";
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
    quantity: number;
    quantityUnit: "contracts";
    estimatedStopLossRisk: number;
    maxPermittedOrderLoss: number;
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
}

/**
 * Derive permissible XAU quantity from individual order allocation under verified constraints.
 */
export function sizeOrderQuantityFromAllocation(
  input: SizeOrderQuantityInput,
): SizeOrderQuantityResult {
  const notes: string[] = [];
  const c = input.contract;

  if (!c?.verified) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: null,
      code: "SIZE_QTY_CONTRACT_UNVERIFIED",
      message: "Contract metadata unverified — quantity not invented.",
      constraints: null,
      notes,
    };
  }
  if (c.quantityUnitAmbiguous || c.quantityUnit !== "contracts") {
    return {
      ok: false,
      quantity: null,
      quantityUnit: c.quantityUnit === "contracts" ? "contracts" : "unknown",
      code: "SIZE_QTY_UNIT_AMBIGUOUS",
      message: "Quantity unit ambiguous — monetary sizing blocked.",
      constraints: null,
      notes,
    };
  }

  if (!finitePositive(input.verifiedEquity)) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_EQUITY_UNVERIFIED",
      message: "Verified equity required for allocation-aware sizing.",
      constraints: null,
      notes,
    };
  }
  const ccy = String(input.accountCurrency ?? "").trim().toUpperCase();
  if (!ccy) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_ACCOUNT_CURRENCY_MISSING",
      message: "Account currency unverified — conversion not invented.",
      constraints: null,
      notes,
    };
  }
  if (ccy !== "USD") {
    // Quote is XAU/USD; without a verified conversion path, block non-USD accounts.
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_CURRENCY_CONVERSION_UNVERIFIED",
      message:
        `Account currency ${ccy} ≠ USD — monetary conversion path unverified; quantity not invented.`,
      constraints: null,
      notes,
    };
  }

  if (
    !finitePositive(input.strategyAllocationPercent)
    || input.strategyAllocationPercent < 1
    || input.strategyAllocationPercent > 100
  ) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_STRATEGY_PCT_INVALID",
      message: "Strategy allocation percent must be a verified value in 1–100.",
      constraints: null,
      notes,
    };
  }

  if (!finiteNonNeg(input.remainingStrategyBudget)) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_REMAINING_BUDGET_UNVERIFIED",
      message: "Remaining strategy budget unverified — sizing blocked.",
      constraints: null,
      notes,
    };
  }

  if (!finitePositive(input.individualOrderAllocation)) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_ORDER_ALLOCATION_INVALID",
      message: "Individual order allocation must be a finite positive amount.",
      constraints: null,
      notes,
    };
  }

  if (input.individualOrderAllocation > input.remainingStrategyBudget + 1e-9) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_EXCEEDS_REMAINING_BUDGET",
      message: "Order allocation exceeds remaining strategy budget.",
      constraints: null,
      notes,
    };
  }

  if (input.exposureAuthoritative !== true) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_EXPOSURE_UNVERIFIED",
      message: "Orders/Trades exposure not authoritative — sizing fail-closed.",
      constraints: null,
      notes,
    };
  }

  if (!finitePositive(input.entryPrice) || !finitePositive(input.stopLoss)) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_PRICES_MISSING",
      message: "Entry and Stop Loss required to size quantity from risk ceiling.",
      constraints: null,
      notes,
    };
  }

  const move = Math.abs(input.entryPrice - input.stopLoss);
  if (!(move > 0)) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_ZERO_STOP_DISTANCE",
      message: "Stop distance is zero — cannot size quantity.",
      constraints: null,
      notes,
    };
  }

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
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: constraints.blockCode ?? "SIZE_QTY_CONSTRAINTS_BLOCKED",
      message: constraints.blockMessage ?? "Quantity min/step constraints blocked sizing.",
      constraints,
      notes: [...notes, ...constraints.notes],
    };
  }

  let riskPerUnit: number | null = null;
  let method: "POINT_COST" | "CONTRACT_MULTIPLIER" | null = null;
  if (
    finitePositive(c.pipCostAccount)
    && finitePositive(c.pointSize)
  ) {
    riskPerUnit = (move / c.pointSize) * c.pipCostAccount;
    method = "POINT_COST";
  } else if (finitePositive(c.contractMultiplier)) {
    riskPerUnit = move * c.contractMultiplier;
    method = "CONTRACT_MULTIPLIER";
  }
  if (riskPerUnit == null || !(riskPerUnit > 0) || method == null) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_RISK_PER_UNIT_UNVERIFIED",
      message: "No verified pip/point cost or contract multiplier for monetary SL risk.",
      constraints,
      notes,
    };
  }

  const maxPermittedOrderLoss = computePerOrderLossLimit(input.individualOrderAllocation);
  const rawQty = maxPermittedOrderLoss / riskPerUnit;
  const quantity = floorQuantityToStep(
    rawQty,
    constraints.quantityStep,
    constraints.quantityMin,
  );
  if (quantity == null) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_BELOW_MIN_AFTER_FLOOR",
      message:
        `Risk ceiling $${maxPermittedOrderLoss} cannot fund minimum ${constraints.quantityMin} `
        + `${constraints.quantityUnit} after flooring to step ${constraints.quantityStep}.`,
      constraints,
      notes,
    };
  }

  const estimatedStopLossRisk = riskPerUnit * quantity;
  if (estimatedStopLossRisk > maxPermittedOrderLoss + 1e-8) {
    return {
      ok: false,
      quantity: null,
      quantityUnit: "contracts",
      code: "SIZE_QTY_EXCEEDS_LOSS_LIMIT",
      message: "Floored quantity would still exceed 25% per-order loss limit — blocked.",
      constraints,
      notes,
    };
  }

  const marginPer =
    finitePositive(input.marginPerUnitAccount)
      ? input.marginPerUnitAccount
      : finitePositive(c.marginPerLotAccount)
        ? c.marginPerLotAccount
        : null;

  let requiredMargin: number | null = null;
  if (marginPer != null) {
    requiredMargin = marginPer * quantity;
    notes.push("Required margin = marginPerUnit × quantity (not equal to order allocation).");
  } else {
    notes.push("Required margin UNAVAILABLE — marginPerUnit unverified; quantity still risk-sized.");
  }

  const freeMargin = finiteNonNeg(input.freeMargin) ? input.freeMargin : null;
  if (requiredMargin != null) {
    if (freeMargin == null) {
      return {
        ok: false,
        quantity: null,
        quantityUnit: "contracts",
        code: "SIZE_QTY_FREE_MARGIN_UNVERIFIED",
        message: "Required margin computed but free margin unverified — sizing blocked.",
        constraints,
        notes,
      };
    }
    if (requiredMargin > freeMargin + 1e-8) {
      // Try stepping down quantity to fit free margin without rounding up.
      let fit = quantity;
      while (fit >= constraints.quantityMin - 1e-12) {
        const need = marginPer! * fit;
        if (need <= freeMargin + 1e-8) {
          const refitRisk = riskPerUnit * fit;
          if (refitRisk <= maxPermittedOrderLoss + 1e-8) {
            return {
              ok: true,
              quantity: fit,
              quantityUnit: "contracts",
              estimatedStopLossRisk: refitRisk,
              maxPermittedOrderLoss,
              riskPerUnit,
              requiredMargin: need,
              freeMargin,
              remainingStrategyBudgetAfter:
                input.remainingStrategyBudget - input.individualOrderAllocation,
              constraints,
              method,
              notes: [
                ...notes,
                "Quantity reduced to fit verified free margin without rounding up.",
              ],
            };
          }
        }
        fit = Math.round((fit - constraints.quantityStep) / constraints.quantityStep)
          * constraints.quantityStep;
      }
      return {
        ok: false,
        quantity: null,
        quantityUnit: "contracts",
        code: "SIZE_QTY_INSUFFICIENT_FREE_MARGIN",
        message: "Verified free margin cannot support minimum quantity under risk ceiling.",
        constraints,
        notes,
      };
    }
  } else if (freeMargin == null) {
    notes.push("Free margin not supplied — margin gate skipped (margin metadata also missing).");
  }

  return {
    ok: true,
    quantity,
    quantityUnit: "contracts",
    estimatedStopLossRisk,
    maxPermittedOrderLoss,
    riskPerUnit,
    requiredMargin,
    freeMargin,
    remainingStrategyBudgetAfter:
      input.remainingStrategyBudget - input.individualOrderAllocation,
    constraints,
    method,
    notes,
  };
}
