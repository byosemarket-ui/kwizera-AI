/**
 * Phase 56.2.2 — Margin allocation (12–25% of equity) and independent 3R target math.
 * Allocation is NOT stop-loss risk. Never invents ounces, costs, or hard max-loss %.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { AtSimContractMetaInput } from "./types.js";

/** Owner-approved allocation range (margin/position sizing input). */
export const ALLOCATION_PCT_MIN = 12;
export const ALLOCATION_PCT_MAX = 25;

export type AllocationPctValidation =
  | { ok: true; allocationPercentage: number }
  | { ok: false; code: "ALLOCATION_PCT_MISSING" | "ALLOCATION_PCT_BELOW_MIN" | "ALLOCATION_PCT_ABOVE_MAX" | "ALLOCATION_PCT_INVALID"; message: string };

export function validateAllocationPercentage(
  raw: number | null | undefined,
): AllocationPctValidation {
  if (raw == null) {
    return {
      ok: false,
      code: "ALLOCATION_PCT_MISSING",
      message: "Allocation percentage was not supplied (12–25% range is optional input; not forced).",
    };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      code: "ALLOCATION_PCT_INVALID",
      message: "Allocation percentage must be a finite number.",
    };
  }
  if (raw < ALLOCATION_PCT_MIN) {
    return {
      ok: false,
      code: "ALLOCATION_PCT_BELOW_MIN",
      message: `Allocation ${raw}% is below the owner-approved minimum ${ALLOCATION_PCT_MIN}%.`,
    };
  }
  if (raw > ALLOCATION_PCT_MAX) {
    return {
      ok: false,
      code: "ALLOCATION_PCT_ABOVE_MAX",
      message: `Allocation ${raw}% is above the owner-approved maximum ${ALLOCATION_PCT_MAX}%.`,
    };
  }
  return { ok: true, allocationPercentage: raw };
}

/**
 * allocationBudget = verifiedEquity * (allocationPercentage / 100).
 * This is a sizing input — never labeled as stop-loss risk.
 */
export function computeAllocationBudget(
  verifiedEquity: number | null | undefined,
  allocationPercentage: number,
): { ok: true; allocationBudget: number; equityUsed: number } | { ok: false; code: string; message: string } {
  if (typeof verifiedEquity !== "number" || !Number.isFinite(verifiedEquity) || verifiedEquity <= 0) {
    return {
      ok: false,
      code: "ALLOCATION_EQUITY_MISSING",
      message: "Verified account equity is required to compute allocation budget (balance/usableMargin are not substituted).",
    };
  }
  const range = validateAllocationPercentage(allocationPercentage);
  if (!range.ok) return { ok: false, code: range.code, message: range.message };
  return {
    ok: true,
    allocationBudget: verifiedEquity * (allocationPercentage / 100),
    equityUsed: verifiedEquity,
  };
}

export type EstimatedSlRiskResult =
  | {
    ok: true;
    estimatedStopLossRisk: number;
    priceMove: number;
    quantity: number;
    method: "POINT_COST" | "CONTRACT_MULTIPLIER";
  }
  | {
    ok: false;
    estimatedStopLossRisk: null;
    code: string;
    message: string;
  };

/**
 * Independent monetary SL risk. Does not use allocationPercentage.
 */
export function estimateStopLossRisk(input: {
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  quantity: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
}): EstimatedSlRiskResult {
  const entry = input.entryPrice;
  const sl = input.stopLoss;
  const qty = input.quantity;
  const c = input.contract;

  if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) {
    return { ok: false, estimatedStopLossRisk: null, code: "SL_RISK_ENTRY_INVALID", message: "Entry price unavailable for SL risk." };
  }
  if (typeof sl !== "number" || !Number.isFinite(sl) || sl <= 0) {
    return { ok: false, estimatedStopLossRisk: null, code: "SL_RISK_SL_INVALID", message: "Stop Loss unavailable for SL risk." };
  }
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) {
    return {
      ok: false,
      estimatedStopLossRisk: null,
      code: "SL_RISK_QUANTITY_UNAVAILABLE",
      message: "Quantity unavailable — monetary SL risk not invented.",
    };
  }
  if (!c || !c.verified) {
    return {
      ok: false,
      estimatedStopLossRisk: null,
      code: "SL_RISK_CONTRACT_UNVERIFIED",
      message: "Contract metadata unverified — monetary SL risk blocked.",
    };
  }
  if (c.quantityUnitAmbiguous || !c.quantityUnit || c.quantityUnit === "unknown") {
    return {
      ok: false,
      estimatedStopLossRisk: null,
      code: "SL_RISK_QUANTITY_UNIT_AMBIGUOUS",
      message: "Quantity unit ambiguous — XAU ounces not assumed; R not fabricated.",
    };
  }

  const priceMove = Math.abs(entry - sl);
  if (!(priceMove > 0)) {
    return {
      ok: false,
      estimatedStopLossRisk: null,
      code: "SL_RISK_ZERO_DISTANCE",
      message: "Stop distance is zero — monetary risk undefined.",
    };
  }

  if (
    typeof c.pipCostAccount === "number"
    && Number.isFinite(c.pipCostAccount)
    && c.pipCostAccount > 0
    && typeof c.pointSize === "number"
    && Number.isFinite(c.pointSize)
    && c.pointSize > 0
  ) {
    const estimatedStopLossRisk = (priceMove / c.pointSize) * c.pipCostAccount * qty;
    if (!Number.isFinite(estimatedStopLossRisk) || estimatedStopLossRisk <= 0) {
      return {
        ok: false,
        estimatedStopLossRisk: null,
        code: "SL_RISK_CALC_INVALID",
        message: "Computed SL risk is non-finite or non-positive.",
      };
    }
    return {
      ok: true,
      estimatedStopLossRisk,
      priceMove,
      quantity: qty,
      method: "POINT_COST",
    };
  }

  if (
    typeof c.contractMultiplier === "number"
    && Number.isFinite(c.contractMultiplier)
    && c.contractMultiplier > 0
  ) {
    const estimatedStopLossRisk = priceMove * c.contractMultiplier * qty;
    if (!Number.isFinite(estimatedStopLossRisk) || estimatedStopLossRisk <= 0) {
      return {
        ok: false,
        estimatedStopLossRisk: null,
        code: "SL_RISK_CALC_INVALID",
        message: "Computed SL risk is non-finite or non-positive.",
      };
    }
    return {
      ok: true,
      estimatedStopLossRisk,
      priceMove,
      quantity: qty,
      method: "CONTRACT_MULTIPLIER",
    };
  }

  return {
    ok: false,
    estimatedStopLossRisk: null,
    code: "SL_RISK_VALUE_PER_MOVE_UNVERIFIED",
    message: "No verified pip/point cost or contract multiplier — R not fabricated.",
  };
}

export type Target3RResult =
  | {
    ok: true;
    targetReward3R: number;
    theoreticalTakeProfit3R: number;
    riskRewardRatio: number | null;
    estimatedGrossTarget: number;
    estimatedNetTarget: number | null;
    estimatedNetTargetStatus: "COMPUTED" | "NOT_VERIFIED";
  }
  | {
    ok: false;
    targetReward3R: null;
    theoreticalTakeProfit3R: null;
    riskRewardRatio: null;
    estimatedGrossTarget: null;
    estimatedNetTarget: null;
    estimatedNetTargetStatus: "NOT_VERIFIED";
    code: string;
    message: string;
  };

/**
 * 3R monetary target and theoretical TP price from stop distance × 3.
 * Does not invent R when estimateStopLossRisk failed.
 */
export function compute3RTarget(input: {
  direction: AtBinaryDirection | null | undefined;
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  estimatedStopLossRisk: number | null | undefined;
  priceMove: number | null | undefined;
  digits: number | null | undefined;
  costDataVerified: boolean;
  estimatedCostsAccount: number | null | undefined;
}): Target3RResult {
  const dir = input.direction;
  const entry = input.entryPrice;
  const sl = input.stopLoss;
  const R = input.estimatedStopLossRisk;
  const move = input.priceMove;

  if (dir !== "BUY" && dir !== "SELL") {
    return fail3r("TARGET_3R_DIRECTION_INVALID", "Direction missing for 3R target.");
  }
  if (typeof entry !== "number" || !(entry > 0) || typeof sl !== "number" || !(sl > 0)) {
    return fail3r("TARGET_3R_PRICES_INVALID", "Entry/SL required for 3R target.");
  }
  if (typeof R !== "number" || !Number.isFinite(R) || R <= 0) {
    return fail3r("TARGET_3R_R_UNAVAILABLE", "Monetary R unavailable — 3R target not fabricated.");
  }
  if (typeof move !== "number" || !Number.isFinite(move) || move <= 0) {
    return fail3r("TARGET_3R_DISTANCE_INVALID", "Stop distance unavailable for theoretical TP.");
  }

  const targetReward3R = 3 * R;
  const rawTp = dir === "BUY" ? entry + 3 * move : entry - 3 * move;
  const theoreticalTakeProfit3R = roundToDigits(rawTp, input.digits);

  if (dir === "BUY" && !(theoreticalTakeProfit3R > entry)) {
    return fail3r("TARGET_3R_GEOMETRY_BUY", "Theoretical BUY 3R TP is not above entry.");
  }
  if (dir === "SELL" && !(theoreticalTakeProfit3R < entry)) {
    return fail3r("TARGET_3R_GEOMETRY_SELL", "Theoretical SELL 3R TP is not below entry.");
  }

  let riskRewardRatio: number | null = null;
  const tp = input.takeProfit;
  if (typeof tp === "number" && Number.isFinite(tp) && tp > 0) {
    const rewardMove = Math.abs(tp - entry);
    // Reward scales with same method as R: ratio of price distances when R∝move.
    if (move > 0 && rewardMove > 0) {
      riskRewardRatio = rewardMove / move;
    }
  }

  let estimatedNetTarget: number | null = null;
  let estimatedNetTargetStatus: "COMPUTED" | "NOT_VERIFIED" = "NOT_VERIFIED";
  if (
    input.costDataVerified
    && typeof input.estimatedCostsAccount === "number"
    && Number.isFinite(input.estimatedCostsAccount)
    && input.estimatedCostsAccount >= 0
  ) {
    estimatedNetTarget = targetReward3R - input.estimatedCostsAccount;
    estimatedNetTargetStatus = "COMPUTED";
  }

  return {
    ok: true,
    targetReward3R,
    theoreticalTakeProfit3R,
    riskRewardRatio,
    estimatedGrossTarget: targetReward3R,
    estimatedNetTarget,
    estimatedNetTargetStatus,
  };
}

function fail3r(code: string, message: string): Target3RResult {
  return {
    ok: false,
    targetReward3R: null,
    theoreticalTakeProfit3R: null,
    riskRewardRatio: null,
    estimatedGrossTarget: null,
    estimatedNetTarget: null,
    estimatedNetTargetStatus: "NOT_VERIFIED",
    code,
    message,
  };
}

function roundToDigits(price: number, digits: number | null | undefined): number {
  if (digits == null || !Number.isInteger(digits) || digits < 0) return price;
  const f = 10 ** digits;
  return Math.round(price * f) / f;
}

/** Weak / stale / contradictory evidence must not force 12–25% allocation. */
export type MarketEvidenceStrength =
  | "SUFFICIENT"
  | "WEAK"
  | "CONTRADICTORY"
  | "INSUFFICIENT"
  | "STALE";

export function shouldForceAllocation(evidence: MarketEvidenceStrength | null | undefined): boolean {
  if (evidence == null) return false;
  return evidence === "SUFFICIENT";
}
