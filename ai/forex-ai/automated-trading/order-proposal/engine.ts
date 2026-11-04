/**
 * Step 2 — Deterministic Risk / Capital / Order Construction engine.
 * Consumes Step 1 handoff + verified inputs. Never mutates the broker.
 */
import { randomUUID } from "node:crypto";
import {
  allocatePerOrderFromRemaining,
  computeCapitalAllocationBudget,
  computePerOrderRiskBreakdown,
  validateStrategyAllocationPercent,
} from "../simulation-risk/capital-budget.js";
import {
  ensureAmountInAccountCurrency,
  type ConversionRateSnapshot,
} from "../simulation-risk/currency-conversion.js";
import { proposeTakeProfit3RPrice } from "../simulation-risk/propose-levels.js";
import {
  floorQuantityToStep,
  resolveXauQuantityConstraints,
} from "../simulation-risk/quantity-constraints.js";
import { sizeOrderQuantityFromAllocation } from "../simulation-risk/size-order-quantity.js";
import type { AtSimContractMetaInput } from "../simulation-risk/types.js";
import type { AtOrderPreparationHandoff } from "../result-intake/types.js";
import {
  AT_ORDER_PROPOSAL_PHASE,
  AT_ORDER_PROPOSAL_SCHEMA,
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
  RISK_POLICY_ID,
  RISK_POLICY_VERSION,
  type AtOrderProposalBlockCode,
  type AtOrderProposalBlocker,
  type AtOrderProposalRecord,
} from "./types.js";

const TP_NOTE =
  "3R is a planned target derived from Entry–SL distance (RewardDistance = 3 × RiskDistance). Not a guaranteed return.";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function roundToTick(price: number, tickSize: number | null | undefined, digits: number | null | undefined): number | null {
  if (!Number.isFinite(price)) return null;
  if (finitePositive(tickSize)) {
    const steps = Math.round(price / tickSize);
    const aligned = steps * tickSize;
    if (Math.abs(aligned - price) > tickSize * 1e-6 + 1e-12) {
      return null; // not on tick — caller treats as INVALID_PRICE_PRECISION
    }
    return aligned;
  }
  if (typeof digits === "number" && Number.isFinite(digits) && digits >= 0) {
    const f = 10 ** Math.floor(digits);
    return Math.round(price * f) / f;
  }
  return price;
}

function priceOnTick(price: number, tickSize: number | null | undefined): boolean {
  if (!finitePositive(tickSize)) return true;
  const q = price / tickSize;
  return Math.abs(q - Math.round(q)) < 1e-8;
}

function emptyPricePlan(): AtOrderProposalRecord["pricePlan"] {
  return {
    entryType: "UNSET",
    entryPrice: null,
    entryZoneLow: null,
    entryZoneHigh: null,
    stopLoss: null,
    takeProfit: null,
    riskDistance: null,
    rewardDistance: null,
    plannedRewardRiskRatio: null,
    takeProfitLabel: "3R_PLANNED_TARGET",
    takeProfitNote: TP_NOTE,
    invalidationConditions: [],
  };
}

function emptyCapital(): AtOrderProposalRecord["capital"] {
  return {
    verifiedEquity: null,
    accountCurrency: null,
    strategyAllocationPercent: null,
    strategyAllocationBudget: null,
    individualOrderAllocation: null,
    allocatedAmount: null,
    existingCommittedExposure: null,
    pendingProposalReservations: null,
    remainingStrategyBudget: null,
    riskTargetPercent: PER_ORDER_RISK_TARGET_PERCENT,
    riskTargetAmount: null,
    riskMaximumPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
    maximumPermittedOrderLoss: null,
    allowedRiskAmount: null,
    projectedLossAtStopLoss: null,
    remainingRiskBudget: null,
    aggregateOpenRisk: null,
    pendingProposalRisk: null,
    aggregateRiskPercentPolicy: null,
    riskValidationStatus: "NOT_EVALUATED",
    riskPolicyId: RISK_POLICY_ID,
    riskPolicyVersion: RISK_POLICY_VERSION,
    currency: null,
    configVersion: null,
    lastUpdateAtUtc: null,
  };
}

function emptyQuantity(): AtOrderProposalRecord["quantity"] {
  return {
    calculatedQuantity: null,
    normalizedQuantity: null,
    lotContractUnit: null,
    contractSize: null,
    tickSize: null,
    pipTickValue: null,
    brokerMinimum: null,
    brokerMaximum: null,
    quantityStep: null,
    ownerMaxQuantity: OWNER_MAX_QUANTITY,
    estimatedMargin: null,
    availableMargin: null,
    usedMargin: null,
    projectedMarginUtilization: null,
    existingExposure: null,
    projectedExposure: null,
    sizingMethod: null,
  };
}

function emptyBrokerPrep(): AtOrderProposalRecord["brokerPrep"] {
  return {
    accountReference: null,
    instrumentOfferReference: null,
    buySell: null,
    amountQuantity: null,
    orderType: null,
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    timeInForce: null,
    expiration: null,
    clientReference: null,
    brokerOrderId: null,
    brokerTradeId: null,
    note: "Preparation fields only — no broker order ID exists; nothing submitted.",
  };
}

function block(code: AtOrderProposalBlockCode | string, message: string): AtOrderProposalBlocker {
  return { code, message };
}

function mapSizerCode(code: string): AtOrderProposalBlockCode | string {
  switch (code) {
    case "SIZE_QTY_CONTRACT_UNVERIFIED":
    case "SIZE_QTY_UNIT_AMBIGUOUS":
    case "SIZE_QTY_RISK_PER_UNIT_UNVERIFIED":
      return "MISSING_INSTRUMENT_SPEC";
    case "SIZE_QTY_EQUITY_UNVERIFIED":
      return "MISSING_ACCOUNT_EQUITY";
    case "SIZE_QTY_FREE_MARGIN_UNVERIFIED":
      return "MISSING_MARGIN_DATA";
    case "SIZE_QTY_INSUFFICIENT_FREE_MARGIN":
      return "INSUFFICIENT_AVAILABLE_MARGIN";
    case "SIZE_QTY_EXCEEDS_REMAINING_BUDGET":
    case "SIZE_QTY_STRATEGY_PCT_INVALID":
      return "ALLOCATION_BUDGET_EXCEEDED";
    case "SIZE_QTY_EXPOSURE_UNVERIFIED":
      return "EXPOSURE_UNVERIFIED";
    case "SIZE_QTY_BELOW_MIN_AFTER_FLOOR":
      return "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY";
    case "SIZE_QTY_EXCEEDS_LOSS_LIMIT":
      return "RISK_LIMIT_EXCEEDED";
    case "SIZE_QTY_EXCEEDS_RISK_TARGET":
      return "RISK_TARGET_EXCEEDED";
    case "FX_RATE_MISSING":
    case "FX_RATE_UNAVAILABLE":
    case "CONVERSION_RATE_MISSING":
      return "MISSING_FX_CONVERSION";
    case "FX_RATE_STALE":
    case "CONVERSION_RATE_STALE":
      return "STALE_FX_CONVERSION";
    default:
      return code.startsWith("SIZE_") || code.startsWith("FX_") ? code : "SIZING_FAILED";
  }
}

export interface BuildOrderProposalInput {
  handoff: AtOrderPreparationHandoff | null | undefined;
  /** Explicit canonical decision when handoff absent (tests). */
  canonicalDecision?: "BUY" | "SELL" | "NO_TRADE" | null;
  analysisId?: string | null;
  resultIntakeId?: string | null;
  observationId?: string | null;
  imageId?: string | null;
  imageHash?: string | null;
  instrument?: string | null;
  timeframe?: string | null;
  strategyId?: string | null;
  environment?: "DEMO" | "LIVE" | null;
  strategyRationale?: string[];
  supportingEvidence?: string[];
  conflictingEvidence?: string[];
  analysisConfidencePct?: number | null;
  confidenceCalibrationFlag?: boolean;
  invalidationConditions?: string[];

  entryPrice?: number | null;
  entryZoneLow?: number | null;
  entryZoneHigh?: number | null;
  stopLoss?: number | null;

  verifiedEquity?: number | null;
  accountCurrency?: string | null;
  equityFresh?: boolean | null;
  equityFetchedAtUtc?: string | null;
  usableMargin?: number | null;
  usedMargin?: number | null;
  marginFresh?: boolean | null;
  accountIdMasked?: string | null;

  strategyAllocationPercent?: number | null;
  individualOrderAllocation?: number | null;
  allocationCurrency?: string | null;
  existingCommittedExposure?: number | null;
  pendingProposalReservations?: number | null;
  configVersion?: number | null;
  allocationUpdatedAtUtc?: string | null;

  contract?: AtSimContractMetaInput | null;
  contractFresh?: boolean | null;
  sdkMinQuantity?: number | null;
  legacyLotStep?: number | null;
  marginPerUnitAccount?: number | null;
  brokerMaxQuantity?: number | null;

  exposureAuthoritative?: boolean | null;
  existingExposure?: number | null;
  maxExposureLimit?: number | null;

  conversionRateSnapshot?: ConversionRateSnapshot | null;

  systemMasterOn?: boolean | null;
  tradingEnabled?: boolean | null;
  emergencyEntryLock?: boolean | null;

  nowMs?: number;
  proposalId?: string;
  idempotencyKey?: string;
}

function resolveEntry(input: BuildOrderProposalInput): {
  ok: true;
  entryPrice: number;
  entryType: AtOrderProposalRecord["pricePlan"]["entryType"];
  zoneLow: number | null;
  zoneHigh: number | null;
} | { ok: false; blockers: AtOrderProposalBlocker[] } {
  if (finitePositive(input.entryPrice)) {
    return {
      ok: true,
      entryPrice: input.entryPrice,
      entryType: "EXPLICIT",
      zoneLow: finitePositive(input.entryZoneLow) ? input.entryZoneLow : null,
      zoneHigh: finitePositive(input.entryZoneHigh) ? input.entryZoneHigh : null,
    };
  }
  const low = input.entryZoneLow;
  const high = input.entryZoneHigh;
  if (finitePositive(low) && finitePositive(high) && high >= low) {
    const mid = (low + high) / 2;
    return { ok: true, entryPrice: mid, entryType: "ZONE", zoneLow: low, zoneHigh: high };
  }
  return {
    ok: false,
    blockers: [block("INVALID_ENTRY", "No valid entry price or entry zone supplied — entry not invented.")],
  };
}

/**
 * Build a complete order proposal. Pure aside from UUID generation.
 */
export function buildOrderProposal(input: BuildOrderProposalInput): AtOrderProposalRecord {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const proposalId = input.proposalId ?? randomUUID();
  const handoff = input.handoff ?? null;

  const directionRaw =
    handoff?.canonicalDirection
    ?? (input.canonicalDecision === "BUY" || input.canonicalDecision === "SELL"
      ? input.canonicalDecision
      : null);
  const canonicalDecision =
    handoff?.canonicalDirection
    ?? input.canonicalDecision
    ?? null;

  const idempotencyKey =
    input.idempotencyKey
    ?? [
      handoff?.acceptedResultId ?? input.resultIntakeId ?? "none",
      handoff?.analysisId ?? input.analysisId ?? "none",
      directionRaw ?? "none",
    ].join(":");

  const base: AtOrderProposalRecord = {
    schemaVersion: AT_ORDER_PROPOSAL_SCHEMA,
    phase: AT_ORDER_PROPOSAL_PHASE,
    proposalId,
    idempotencyKey,
    createdAtUtc: nowIso,
    updatedAtUtc: nowIso,
    lifecycle: "RECEIVED",
    analysisId: handoff?.analysisId ?? input.analysisId ?? null,
    resultIntakeId: handoff?.acceptedResultId ?? input.resultIntakeId ?? null,
    observationId: handoff?.observationId ?? input.observationId ?? null,
    imageId: handoff?.imageId ?? input.imageId ?? null,
    imageHash: handoff?.imageHash ?? input.imageHash ?? null,
    instrument: handoff?.instrument ?? input.instrument ?? null,
    timeframe: input.timeframe ?? null,
    strategyId: input.strategyId ?? null,
    environment: input.environment ?? null,
    canonicalDecision: canonicalDecision === "BUY" || canonicalDecision === "SELL" || canonicalDecision === "NO_TRADE"
      ? canonicalDecision
      : null,
    direction: directionRaw === "BUY" || directionRaw === "SELL" ? directionRaw : null,
    strategyRationale: input.strategyRationale ?? [],
    supportingEvidence: input.supportingEvidence ?? [],
    conflictingEvidence: input.conflictingEvidence ?? [],
    analysisConfidencePct:
      handoff?.directionalConfidencePct ?? input.analysisConfidencePct ?? null,
    confidenceCalibrationFlag:
      input.confidenceCalibrationFlag
      ?? handoff?.isCalibratedWinProbability
      ?? false,
    pricePlan: emptyPricePlan(),
    capital: emptyCapital(),
    quantity: emptyQuantity(),
    brokerPrep: emptyBrokerPrep(),
    blockers: [],
    notes: [
      "ORDER PROPOSAL only — not broker execution. placesOrders=false, acceptsForExecution=false, mutatesBroker=false.",
    ],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };

  const blockers: AtOrderProposalBlocker[] = [];

  base.lifecycle = "CALCULATING";

  if (input.systemMasterOn === false) {
    blockers.push(block("SYSTEM_MASTER_OFF", "System Master is OFF — new proposal processing blocked."));
  }
  if (input.tradingEnabled === false) {
    blockers.push(block("TRADING_DISABLED", "Trading is DISABLED — proposal construction blocked."));
  }
  if (input.emergencyEntryLock === true) {
    blockers.push(block("EMERGENCY_LOCK", "Emergency entry lock is ON — proposal construction blocked."));
  }

  if (canonicalDecision === "NO_TRADE") {
    blockers.push(block("NO_TRADE_NOT_ELIGIBLE", "NO_TRADE must never produce an executable order proposal."));
  }
  if (directionRaw !== "BUY" && directionRaw !== "SELL") {
    if (!blockers.some((b) => b.code === "NO_TRADE_NOT_ELIGIBLE")) {
      blockers.push(block("NO_CANONICAL_BUY_SELL", "Eligible canonical BUY or SELL required."));
    }
  }

  if (handoff?.resultExpiresAtUtc) {
    const exp = Date.parse(handoff.resultExpiresAtUtc);
    if (Number.isFinite(exp) && nowMs > exp) {
      blockers.push(block("HANDOFF_EXPIRED", "Order-preparation handoff has expired."));
    }
  }

  // Capital allocation (A)
  const pctCheck = validateStrategyAllocationPercent(input.strategyAllocationPercent);
  const equity = input.verifiedEquity;
  const accountCurrency = String(input.accountCurrency ?? "").trim().toUpperCase() || null;

  base.capital.verifiedEquity = finitePositive(equity) ? equity : null;
  base.capital.accountCurrency = accountCurrency;
  base.capital.currency = accountCurrency;
  base.capital.strategyAllocationPercent = pctCheck.ok ? pctCheck.capitalAllocationPercent : null;
  base.capital.configVersion = input.configVersion ?? null;
  base.capital.lastUpdateAtUtc = input.allocationUpdatedAtUtc ?? null;
  base.capital.existingCommittedExposure =
    finiteNonNeg(input.existingCommittedExposure) ? input.existingCommittedExposure : null;
  base.capital.pendingProposalReservations =
    finiteNonNeg(input.pendingProposalReservations) ? input.pendingProposalReservations : null;

  if (input.equityFresh === false) {
    blockers.push(block("STALE_ACCOUNT_EQUITY", "Account equity is stale — proposal blocked."));
  }
  if (!finitePositive(equity)) {
    blockers.push(block("MISSING_ACCOUNT_EQUITY", "Verified account equity is missing."));
  }
  if (!pctCheck.ok) {
    blockers.push(block("INVALID_STRATEGY_ALLOCATION_PCT", pctCheck.message));
  }

  let strategyBudget: number | null = null;
  if (pctCheck.ok && finitePositive(equity)) {
    const budget = computeCapitalAllocationBudget(equity, pctCheck.capitalAllocationPercent);
    if (budget.ok) {
      strategyBudget = budget.capitalAllocationBudget;
      base.capital.strategyAllocationBudget = strategyBudget;
    } else {
      blockers.push(block("ALLOCATION_BUDGET_EXCEEDED", budget.message));
    }
  }

  const reserved =
    (finiteNonNeg(input.existingCommittedExposure) ? input.existingCommittedExposure : 0)
    + (finiteNonNeg(input.pendingProposalReservations) ? input.pendingProposalReservations : 0);

  const perOrderRaw = input.individualOrderAllocation;
  if (perOrderRaw == null) {
    blockers.push(block("PER_ORDER_ALLOCATION_MISSING", "Per-order allocation amount is required."));
  } else if (!finitePositive(perOrderRaw)) {
    blockers.push(block("PER_ORDER_ALLOCATION_INVALID", "Per-order allocation must be a finite positive number."));
  }

  let perOrderAccount: number | null = null;
  if (finitePositive(perOrderRaw) && strategyBudget != null && accountCurrency) {
    const allocCcy = String(input.allocationCurrency ?? "USD").trim().toUpperCase() || "USD";
    const converted = ensureAmountInAccountCurrency({
      amount: perOrderRaw,
      amountCurrency: allocCcy,
      accountCurrency,
      rateSnapshot: input.conversionRateSnapshot,
      nowMs,
    });
    if (!converted.ok) {
      const code = /STALE/i.test(converted.code) ? "STALE_FX_CONVERSION" : "MISSING_FX_CONVERSION";
      blockers.push(block(code, converted.message));
    } else {
      perOrderAccount = converted.amount;
      base.capital.individualOrderAllocation = perOrderAccount;
      const resolved = allocatePerOrderFromRemaining({
        capitalAllocationBudget: strategyBudget,
        reservedActive: reserved,
        requestedPerOrderAllocation: perOrderAccount,
      });
      if (!resolved.ok) {
        blockers.push(block(
          resolved.code === "STRATEGY_BUDGET_EXHAUSTED" || resolved.code === "PER_ORDER_EXCEEDS_REMAINING_BUDGET"
            ? "ALLOCATION_BUDGET_EXCEEDED"
            : resolved.code,
          resolved.message,
        ));
      } else {
        base.capital.allocatedAmount = resolved.perOrderAllocation;
        base.capital.remainingStrategyBudget = resolved.remainingAfter;
        const riskBd = computePerOrderRiskBreakdown(resolved.perOrderAllocation);
        base.capital.riskTargetPercent = riskBd.riskTargetPercent;
        base.capital.riskTargetAmount = riskBd.riskTargetAmount;
        base.capital.riskMaximumPercent = riskBd.riskMaximumPercent;
        base.capital.maximumPermittedOrderLoss = riskBd.maximumPermittedOrderLoss;
        base.capital.allowedRiskAmount = riskBd.allowedRiskAmount;
        base.capital.riskPolicyId = RISK_POLICY_ID;
        base.capital.riskPolicyVersion = RISK_POLICY_VERSION;
      }
    }
  }

  // Margin freshness
  if (input.marginFresh === false) {
    blockers.push(block("STALE_MARGIN_DATA", "Margin data is stale — proposal blocked."));
  }
  if (input.usableMargin == null && input.marginFresh !== true) {
    // Only force missing when we cannot assert freshness/availability
  }
  if (input.usableMargin == null || !finiteNonNeg(input.usableMargin)) {
    blockers.push(block("MISSING_MARGIN_DATA", "Available margin is missing or unverified."));
  }
  base.quantity.availableMargin = finiteNonNeg(input.usableMargin) ? input.usableMargin : null;
  base.quantity.usedMargin = finiteNonNeg(input.usedMargin) ? input.usedMargin : null;

  if (input.contractFresh === false) {
    blockers.push(block("STALE_INSTRUMENT_SPEC", "Instrument specifications are stale — proposal blocked."));
  }
  if (!input.contract?.verified) {
    blockers.push(block("MISSING_INSTRUMENT_SPEC", "Verified instrument contract specifications are required."));
  }

  if (input.exposureAuthoritative !== true) {
    blockers.push(block("EXPOSURE_UNVERIFIED", "Existing exposure is not authoritative — proposal blocked."));
  }
  base.quantity.existingExposure = finiteNonNeg(input.existingExposure) ? input.existingExposure : null;

  // Early exit if already blocked on eligibility / gates
  if (blockers.length > 0 && (directionRaw !== "BUY" && directionRaw !== "SELL")) {
    base.lifecycle = "BLOCKED";
    base.blockers = blockers;
    return base;
  }

  base.lifecycle = "VALIDATING";

  // Price plan
  const entryRes = resolveEntry(input);
  if (!entryRes.ok) {
    blockers.push(...entryRes.blockers);
  }
  if (!finitePositive(input.stopLoss)) {
    blockers.push(block("INVALID_STOP_LOSS", "Stop Loss missing — SL not invented."));
  }

  const contract = input.contract;
  const tickSize = contract?.tickSize ?? contract?.pointSize ?? null;
  const digits = contract?.digits ?? null;

  let entryPrice: number | null = entryRes.ok ? entryRes.entryPrice : null;
  let stopLoss: number | null = finitePositive(input.stopLoss) ? input.stopLoss : null;

  if (entryPrice != null && !priceOnTick(entryPrice, tickSize)) {
    blockers.push(block("INVALID_PRICE_PRECISION", `Entry ${entryPrice} is not aligned to tick size ${tickSize}.`));
    entryPrice = null;
  }
  if (stopLoss != null && !priceOnTick(stopLoss, tickSize)) {
    blockers.push(block("INVALID_PRICE_PRECISION", `Stop Loss ${stopLoss} is not aligned to tick size ${tickSize}.`));
    stopLoss = null;
  }

  if (entryPrice != null) {
    const aligned = roundToTick(entryPrice, tickSize, digits);
    if (aligned == null) {
      blockers.push(block("INVALID_PRICE_PRECISION", "Entry price failed tick alignment."));
      entryPrice = null;
    } else {
      entryPrice = aligned;
    }
  }
  if (stopLoss != null) {
    const aligned = roundToTick(stopLoss, tickSize, digits);
    if (aligned == null) {
      blockers.push(block("INVALID_PRICE_PRECISION", "Stop Loss failed tick alignment."));
      stopLoss = null;
    } else {
      stopLoss = aligned;
    }
  }

  if (directionRaw === "BUY" && entryPrice != null && stopLoss != null) {
    if (!(stopLoss < entryPrice)) {
      blockers.push(block("INVALID_SL_GEOMETRY", "BUY Stop Loss must be below Entry."));
    }
  }
  if (directionRaw === "SELL" && entryPrice != null && stopLoss != null) {
    if (!(stopLoss > entryPrice)) {
      blockers.push(block("INVALID_SL_GEOMETRY", "SELL Stop Loss must be above Entry."));
    }
  }

  let takeProfit: number | null = null;
  let riskDistance: number | null = null;
  let rewardDistance: number | null = null;

  if (
    (directionRaw === "BUY" || directionRaw === "SELL")
    && entryPrice != null
    && stopLoss != null
    && !blockers.some((b) => b.code === "INVALID_SL_GEOMETRY")
  ) {
    const tp = proposeTakeProfit3RPrice({
      direction: directionRaw,
      entryPrice,
      stopLoss,
      digits,
    });
    if (!tp.ok) {
      blockers.push(block("INVALID_SL_GEOMETRY", tp.message));
    } else {
      takeProfit = tp.takeProfit;
      riskDistance = tp.stopDistance;
      rewardDistance = Math.abs(tp.takeProfit - entryPrice);
      if (tickSize != null && !priceOnTick(takeProfit, tickSize)) {
        blockers.push(block("INVALID_PRICE_PRECISION", `Take Profit ${takeProfit} is not aligned to tick size ${tickSize}.`));
        takeProfit = null;
      } else if (riskDistance > 0 && rewardDistance / riskDistance + 1e-9 < 3) {
        // Tick/digit normalization must not silently shrink planned R:R below 3:1.
        blockers.push(block(
          "INVALID_PRICE_PRECISION",
          `Normalized Take Profit yields R:R ${(rewardDistance / riskDistance).toFixed(4)} below required 3:1 — blocked.`,
        ));
        takeProfit = null;
        rewardDistance = null;
      } else {
        rewardDistance = 3 * riskDistance;
      }
    }
  }

  base.pricePlan = {
    entryType: entryRes.ok ? entryRes.entryType : "UNSET",
    entryPrice,
    entryZoneLow: entryRes.ok ? entryRes.zoneLow : null,
    entryZoneHigh: entryRes.ok ? entryRes.zoneHigh : null,
    stopLoss,
    takeProfit,
    riskDistance,
    rewardDistance,
    plannedRewardRiskRatio: riskDistance != null && rewardDistance != null ? 3 : null,
    takeProfitLabel: "3R_PLANNED_TARGET",
    takeProfitNote: TP_NOTE,
    invalidationConditions: input.invalidationConditions ?? [],
  };

  // Quantity sizing — only when geometry + capital gates allow
  const hardBlockCodes = new Set(blockers.map((b) => b.code));
  const canSize =
    (directionRaw === "BUY" || directionRaw === "SELL")
    && entryPrice != null
    && stopLoss != null
    && !hardBlockCodes.has("INVALID_SL_GEOMETRY")
    && !hardBlockCodes.has("SYSTEM_MASTER_OFF")
    && !hardBlockCodes.has("TRADING_DISABLED")
    && !hardBlockCodes.has("EMERGENCY_LOCK")
    && !hardBlockCodes.has("STALE_ACCOUNT_EQUITY")
    && !hardBlockCodes.has("MISSING_ACCOUNT_EQUITY")
    && !hardBlockCodes.has("STALE_MARGIN_DATA")
    && !hardBlockCodes.has("MISSING_MARGIN_DATA")
    && !hardBlockCodes.has("MISSING_INSTRUMENT_SPEC")
    && !hardBlockCodes.has("STALE_INSTRUMENT_SPEC")
    && !hardBlockCodes.has("EXPOSURE_UNVERIFIED")
    && !hardBlockCodes.has("ALLOCATION_BUDGET_EXCEEDED")
    && !hardBlockCodes.has("PER_ORDER_ALLOCATION_MISSING")
    && !hardBlockCodes.has("PER_ORDER_ALLOCATION_INVALID")
    && !hardBlockCodes.has("INVALID_STRATEGY_ALLOCATION_PCT")
    && !hardBlockCodes.has("MISSING_FX_CONVERSION")
    && !hardBlockCodes.has("STALE_FX_CONVERSION")
    && perOrderAccount != null
    && strategyBudget != null
    && pctCheck.ok
    && finitePositive(equity);

  let normalizedQty: number | null = null;

  if (canSize) {
    const remainingBefore = strategyBudget! - reserved;
    const sized = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity!,
      accountCurrency,
      strategyAllocationPercent: pctCheck.capitalAllocationPercent,
      remainingStrategyBudget: remainingBefore,
      individualOrderAllocation: perOrderAccount!,
      entryPrice,
      stopLoss,
      contract: contract!,
      freeMargin: input.usableMargin,
      exposureAuthoritative: input.exposureAuthoritative === true,
      marginPerUnitAccount: input.marginPerUnitAccount,
      sdkMinQuantity: input.sdkMinQuantity,
      legacyLotStep: input.legacyLotStep,
      allocationCurrency: accountCurrency, // already converted above
      conversionRateSnapshot: null,
      nowMs,
    });

    const constraints = sized.constraints ?? resolveXauQuantityConstraints({
      quantityUnit: contract?.quantityUnit,
      quantityUnitAmbiguous: contract?.quantityUnitAmbiguous,
      baseUnitSize: contract?.baseUnitSize,
      sdkMinQuantity: input.sdkMinQuantity,
      legacyLotStep: input.legacyLotStep ?? contract?.quantityStep,
      reportedQuantityStep: contract?.quantityStep,
      reportedQuantityMin: contract?.quantityMin,
    });

    base.quantity.brokerMinimum = constraints.quantityMin;
    base.quantity.quantityStep = constraints.quantityStep;
    base.quantity.brokerMaximum =
      finitePositive(input.brokerMaxQuantity) ? input.brokerMaxQuantity : null;
    base.quantity.lotContractUnit = constraints.quantityUnit;
    base.quantity.contractSize = contract?.baseUnitSize ?? contract?.contractMultiplier ?? null;
    base.quantity.tickSize = tickSize;
    base.quantity.pipTickValue = contract?.pipCostAccount ?? null;

    if (!sized.ok) {
      blockers.push(block(mapSizerCode(sized.code), sized.message));
      base.capital.riskValidationStatus = "FAIL";
    } else {
      base.quantity.calculatedQuantity = sized.quantity;
      base.quantity.sizingMethod = sized.method;
      base.capital.projectedLossAtStopLoss = sized.estimatedStopLossRisk;
      base.capital.riskTargetAmount = sized.riskTargetAmount;
      base.capital.maximumPermittedOrderLoss = sized.maxPermittedOrderLoss;
      base.capital.allowedRiskAmount = sized.allowedRiskAmount;
      base.capital.riskTargetPercent = PER_ORDER_RISK_TARGET_PERCENT;
      base.capital.riskMaximumPercent = PER_ORDER_RISK_MAXIMUM_PERCENT;
      base.capital.riskPolicyId = RISK_POLICY_ID;
      base.capital.riskPolicyVersion = RISK_POLICY_VERSION;
      base.capital.remainingStrategyBudget = sized.remainingStrategyBudgetAfter;
      if (sized.allowedRiskAmount != null && sized.estimatedStopLossRisk != null) {
        base.capital.remainingRiskBudget =
          sized.allowedRiskAmount - sized.estimatedStopLossRisk;
      }
      // Pending proposal risk = this proposal's projected loss (aggregate % policy not configured).
      base.capital.pendingProposalRisk = sized.estimatedStopLossRisk;
      base.capital.aggregateOpenRisk =
        finiteNonNeg(input.existingCommittedExposure) ? null : null;
      base.capital.aggregateRiskPercentPolicy = null;

      // Post-floor absolute enforcement (target + hard max).
      if (sized.estimatedStopLossRisk > sized.maxPermittedOrderLoss + 1e-8) {
        blockers.push(block(
          "RISK_LIMIT_EXCEEDED",
          `Projected loss ${sized.estimatedStopLossRisk} exceeds hard maximum ${sized.maxPermittedOrderLoss}.`,
        ));
        base.capital.riskValidationStatus = "FAIL";
      } else if (sized.estimatedStopLossRisk > sized.allowedRiskAmount + 1e-8) {
        blockers.push(block(
          "RISK_TARGET_EXCEEDED",
          `Projected loss ${sized.estimatedStopLossRisk} exceeds risk target ${sized.allowedRiskAmount}. `
          + "Hard 25% is not permission to raise risk above the 20% target.",
        ));
        base.capital.riskValidationStatus = "FAIL";
      } else {
        base.capital.riskValidationStatus = "PASS";
      }

      // Floor-only already applied inside sizer; re-assert owner max 0.01
      let qty = sized.quantity;
      if (qty > OWNER_MAX_QUANTITY + 1e-12) {
        const floored = floorQuantityToStep(
          OWNER_MAX_QUANTITY,
          constraints.quantityStep ?? OWNER_MAX_QUANTITY,
          constraints.quantityMin ?? 0,
        );
        if (floored == null || floored > OWNER_MAX_QUANTITY + 1e-12) {
          blockers.push(block(
            "OWNER_MAX_QUANTITY_EXCEEDED",
            `Calculated quantity ${qty} exceeds owner maximum ${OWNER_MAX_QUANTITY}; cannot floor to a valid step within owner max.`,
          ));
          qty = null as unknown as number;
          base.capital.riskValidationStatus = "FAIL";
        } else {
          qty = floored;
          base.notes.push(`Quantity capped to owner maximum ${OWNER_MAX_QUANTITY} (floor-only).`);
          const riskPerUnit = sized.riskPerUnit;
          const projected = riskPerUnit * qty;
          base.capital.projectedLossAtStopLoss = projected;
          base.capital.pendingProposalRisk = projected;
          base.capital.remainingRiskBudget = sized.allowedRiskAmount - projected;
          if (projected > sized.maxPermittedOrderLoss + 1e-8) {
            blockers.push(block(
              "RISK_LIMIT_EXCEEDED",
              "Projected loss at owner-capped quantity exceeds hard maximum 25%.",
            ));
            base.capital.riskValidationStatus = "FAIL";
          } else if (projected > sized.allowedRiskAmount + 1e-8) {
            blockers.push(block(
              "RISK_TARGET_EXCEEDED",
              "Projected loss at owner-capped quantity exceeds 20% risk target.",
            ));
            base.capital.riskValidationStatus = "FAIL";
          }
        }
      }

      if (qty != null && Number.isFinite(qty)) {
        const brokerMin = constraints.quantityMin;
        if (finitePositive(brokerMin) && qty + 1e-12 < brokerMin) {
          blockers.push(block(
            "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY",
            `Broker minimum ${brokerMin} exceeds allowed quantity ${qty} (owner max ${OWNER_MAX_QUANTITY}). Proposal remains blocked.`,
          ));
        } else if (
          finitePositive(input.brokerMaxQuantity)
          && qty > input.brokerMaxQuantity + 1e-12
        ) {
          blockers.push(block(
            "OWNER_MAX_QUANTITY_EXCEEDED",
            `Quantity ${qty} exceeds broker maximum ${input.brokerMaxQuantity}.`,
          ));
        } else {
          normalizedQty = qty;
          base.quantity.normalizedQuantity = qty;
          base.quantity.estimatedMargin = sized.requiredMargin;
          if (
            sized.requiredMargin != null
            && finiteNonNeg(input.usableMargin)
            && finitePositive(equity)
          ) {
            const used = (finiteNonNeg(input.usedMargin) ? input.usedMargin : 0) + sized.requiredMargin;
            base.quantity.projectedMarginUtilization = used / equity;
          }
          const existingExp = finiteNonNeg(input.existingExposure) ? input.existingExposure : 0;
          base.quantity.projectedExposure = existingExp + (perOrderAccount ?? 0);
          if (
            finitePositive(input.maxExposureLimit)
            && base.quantity.projectedExposure > input.maxExposureLimit + 1e-9
          ) {
            blockers.push(block(
              "EXPOSURE_LIMIT_EXCEEDED",
              `Projected exposure ${base.quantity.projectedExposure} exceeds limit ${input.maxExposureLimit}.`,
            ));
          }
        }
      }
    }
  }

  // Broker prep (never invent order IDs)
  base.brokerPrep = {
    accountReference: input.accountIdMasked ?? null,
    instrumentOfferReference: base.instrument,
    buySell: directionRaw === "BUY" || directionRaw === "SELL" ? directionRaw : null,
    amountQuantity: normalizedQty,
    orderType: base.pricePlan.entryType === "EXPLICIT" || base.pricePlan.entryType === "ZONE"
      ? "LIMIT"
      : null,
    entryPrice: base.pricePlan.entryPrice,
    stopLoss: base.pricePlan.stopLoss,
    takeProfit: base.pricePlan.takeProfit,
    timeInForce: null,
    expiration: handoff?.resultExpiresAtUtc ?? null,
    clientReference: proposalId,
    brokerOrderId: null,
    brokerTradeId: null,
    note: "Preparation fields only — no broker order ID exists; nothing submitted.",
  };

  if (blockers.length > 0) {
    base.lifecycle = "BLOCKED";
    base.blockers = blockers;
    base.quantity.normalizedQuantity = null;
    base.brokerPrep.amountQuantity = null;
    return base;
  }

  if (normalizedQty == null || base.pricePlan.takeProfit == null) {
    base.lifecycle = "BLOCKED";
    base.blockers = [block("SIZING_FAILED", "Proposal incomplete after validation.")];
    return base;
  }

  base.lifecycle = "PROPOSAL_READY";
  base.blockers = [];
  return base;
}
