/**
 * Phase 56.2.3 / Step 2 risk policy —
 * Strategy capital allocation (1–100% of equity) and per-order risk.
 *
 * Per-order risk (v2):
 *   riskTargetAmount          = allocation × 0.20  (normal target)
 *   maximumPermittedOrderLoss = allocation × 0.25  (hard safety ceiling — not UI-increasable)
 *   allowedRiskAmount         = min(riskTarget, hardMax)  (= target under default percents)
 *
 * Strategy budget ≠ broker margin ≠ estimated SL risk.
 */
export const STRATEGY_ALLOCATION_PCT_MIN = 1;
export const STRATEGY_ALLOCATION_PCT_MAX = 100;

/** Normal per-order risk target as fraction of individual order allocation. */
export const PER_ORDER_RISK_TARGET_FRACTION = 0.20;
export const PER_ORDER_RISK_TARGET_PERCENT = 20;

/**
 * Absolute hard maximum loss as fraction of individual order allocation.
 * Safety ceiling — must never be raised via ordinary configuration.
 */
export const PER_ORDER_LOSS_LIMIT_FRACTION = 0.25;
export const PER_ORDER_RISK_MAXIMUM_PERCENT = 25;

/** @deprecated Alias — prefer PER_ORDER_LOSS_LIMIT_FRACTION (hard ceiling). */
export const PER_ORDER_HARD_MAX_FRACTION = PER_ORDER_LOSS_LIMIT_FRACTION;

export const PER_ORDER_RISK_POLICY_VERSION = "per-order-risk-v2-20target-25max" as const;
export const PER_ORDER_RISK_POLICY_VERSION_LEGACY_25 = "per-order-risk-v1-25pct-only" as const;

export type StrategyPctValidation =
  | { ok: true; capitalAllocationPercent: number }
  | {
    ok: false;
    code:
      | "STRATEGY_ALLOC_PCT_MISSING"
      | "STRATEGY_ALLOC_PCT_INVALID"
      | "STRATEGY_ALLOC_PCT_BELOW_MIN"
      | "STRATEGY_ALLOC_PCT_ABOVE_MAX";
    message: string;
  };

export function validateStrategyAllocationPercent(
  raw: number | null | undefined,
): StrategyPctValidation {
  if (raw == null) {
    return {
      ok: false,
      code: "STRATEGY_ALLOC_PCT_MISSING",
      message: "Strategy capital allocation % is not set (1–100). Not auto-filled to 100%.",
    };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      code: "STRATEGY_ALLOC_PCT_INVALID",
      message: "Strategy capital allocation % must be a finite number.",
    };
  }
  if (raw < STRATEGY_ALLOCATION_PCT_MIN) {
    return {
      ok: false,
      code: "STRATEGY_ALLOC_PCT_BELOW_MIN",
      message: `Strategy allocation ${raw}% is below minimum ${STRATEGY_ALLOCATION_PCT_MIN}%.`,
    };
  }
  if (raw > STRATEGY_ALLOCATION_PCT_MAX) {
    return {
      ok: false,
      code: "STRATEGY_ALLOC_PCT_ABOVE_MAX",
      message: `Strategy allocation ${raw}% is above maximum ${STRATEGY_ALLOCATION_PCT_MAX}%.`,
    };
  }
  return { ok: true, capitalAllocationPercent: raw };
}

/**
 * capitalAllocationBudget = verifiedEquity * pct / 100.
 * Never substitutes balance or usableMargin for equity.
 */
export function computeCapitalAllocationBudget(
  verifiedEquity: number | null | undefined,
  capitalAllocationPercent: number,
):
  | { ok: true; capitalAllocationBudget: number; equityUsed: number }
  | { ok: false; code: string; message: string } {
  if (typeof verifiedEquity !== "number" || !Number.isFinite(verifiedEquity) || verifiedEquity <= 0) {
    return {
      ok: false,
      code: "STRATEGY_EQUITY_MISSING",
      message: "Verified account equity is required for strategy capital budget (balance/usableMargin not substituted).",
    };
  }
  const pct = validateStrategyAllocationPercent(capitalAllocationPercent);
  if (!pct.ok) return { ok: false, code: pct.code, message: pct.message };
  return {
    ok: true,
    capitalAllocationBudget:
      Math.round(verifiedEquity * (capitalAllocationPercent / 100) * 1e8) / 1e8,
    equityUsed: verifiedEquity,
  };
}

export type CapitalReservationStatus = "ACTIVE" | "RELEASED";

export interface CapitalBudgetReservation {
  draftId: string;
  environment: string;
  amount: number;
  status: CapitalReservationStatus;
  createdAtUtc: string;
  releasedAtUtc: string | null;
}

export function sumActiveReservations(
  reservations: CapitalBudgetReservation[],
  environment: string,
  excludeDraftId?: string | null,
): number {
  let sum = 0;
  for (const r of reservations) {
    if (r.status !== "ACTIVE") continue;
    if (r.environment !== environment) continue;
    if (excludeDraftId && r.draftId === excludeDraftId) continue;
    if (typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0) {
      sum += r.amount;
    }
  }
  return sum;
}

export function allocatePerOrderFromRemaining(input: {
  capitalAllocationBudget: number;
  reservedActive: number;
  requestedPerOrderAllocation: number | null | undefined;
}):
  | { ok: true; perOrderAllocation: number; remainingBefore: number; remainingAfter: number }
  | { ok: false; code: string; message: string } {
  const budget = input.capitalAllocationBudget;
  const reserved = input.reservedActive;
  if (!(typeof budget === "number" && Number.isFinite(budget) && budget > 0)) {
    return { ok: false, code: "STRATEGY_BUDGET_INVALID", message: "Strategy capital budget is invalid." };
  }
  if (!(typeof reserved === "number" && Number.isFinite(reserved) && reserved >= 0)) {
    return { ok: false, code: "STRATEGY_RESERVED_INVALID", message: "Active reservation total is invalid." };
  }
  const remainingBefore = budget - reserved;
  if (remainingBefore <= 0) {
    return {
      ok: false,
      code: "STRATEGY_BUDGET_EXHAUSTED",
      message: "No remaining strategy capital budget for an additional order allocation.",
    };
  }
  const requested = input.requestedPerOrderAllocation;
  if (requested == null) {
    return {
      ok: false,
      code: "PER_ORDER_ALLOCATION_MISSING",
      message: "Per-order allocation amount is required; full strategy budget is not granted automatically.",
    };
  }
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0) {
    return {
      ok: false,
      code: "PER_ORDER_ALLOCATION_INVALID",
      message: "Per-order allocation must be a finite positive number.",
    };
  }
  if (requested > remainingBefore + 1e-9) {
    return {
      ok: false,
      code: "PER_ORDER_EXCEEDS_REMAINING_BUDGET",
      message: `Requested per-order allocation ${requested} exceeds remaining strategy budget ${remainingBefore}.`,
    };
  }
  return {
    ok: true,
    perOrderAllocation: requested,
    remainingBefore,
    remainingAfter: remainingBefore - requested,
  };
}

/** 20% risk target amount from individual order allocation. */
export function computePerOrderRiskTarget(perOrderAllocation: number): number {
  return perOrderAllocation * PER_ORDER_RISK_TARGET_FRACTION;
}

/**
 * Hard maximum permitted order loss (25% of allocation).
 * Safety ceiling — not an ordinary raisable setting.
 */
export function computePerOrderLossLimit(perOrderAllocation: number): number {
  return perOrderAllocation * PER_ORDER_LOSS_LIMIT_FRACTION;
}

/** Alias for hard maximum (same as computePerOrderLossLimit). */
export function computeMaximumPermittedOrderLoss(perOrderAllocation: number): number {
  return computePerOrderLossLimit(perOrderAllocation);
}

/**
 * allowedRiskAmount = min(riskTarget, hardMaximum).
 * With default 20/25 percents this equals the 20% target.
 */
export function computeAllowedRiskAmount(perOrderAllocation: number): number {
  const target = computePerOrderRiskTarget(perOrderAllocation);
  const hardMax = computePerOrderLossLimit(perOrderAllocation);
  return Math.min(target, hardMax);
}

export interface PerOrderRiskBreakdown {
  perOrderAllocation: number;
  riskTargetPercent: typeof PER_ORDER_RISK_TARGET_PERCENT;
  riskTargetAmount: number;
  riskMaximumPercent: typeof PER_ORDER_RISK_MAXIMUM_PERCENT;
  maximumPermittedOrderLoss: number;
  allowedRiskAmount: number;
  riskPolicyVersion: typeof PER_ORDER_RISK_POLICY_VERSION;
}

export function computePerOrderRiskBreakdown(perOrderAllocation: number): PerOrderRiskBreakdown {
  const riskTargetAmount = computePerOrderRiskTarget(perOrderAllocation);
  const maximumPermittedOrderLoss = computePerOrderLossLimit(perOrderAllocation);
  return {
    perOrderAllocation,
    riskTargetPercent: PER_ORDER_RISK_TARGET_PERCENT,
    riskTargetAmount,
    riskMaximumPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
    maximumPermittedOrderLoss,
    allowedRiskAmount: Math.min(riskTargetAmount, maximumPermittedOrderLoss),
    riskPolicyVersion: PER_ORDER_RISK_POLICY_VERSION,
  };
}

export type PerOrderLossLimitResult =
  | {
    ok: true;
    pass: boolean;
    perOrderAllocation: number;
    perOrderLossLimit: number;
    riskTargetAmount: number;
    allowedRiskAmount: number;
    estimatedStopLossRisk: number;
    code:
      | "PER_ORDER_LOSS_LIMIT_PASS"
      | "PER_ORDER_LOSS_LIMIT_EXCEEDED"
      | "PER_ORDER_RISK_TARGET_EXCEEDED";
    message: string;
  }
  | {
    ok: false;
    pass: false;
    perOrderAllocation: number | null;
    perOrderLossLimit: number | null;
    riskTargetAmount: number | null;
    allowedRiskAmount: number | null;
    estimatedStopLossRisk: number | null;
    code: string;
    message: string;
  };

/**
 * Enforce risk target (20%) and hard maximum (25%).
 * Pass only when projected loss <= allowedRiskAmount (target under default policy).
 * Hard-max exceed is a distinct failure code.
 */
export function evaluatePerOrderLossLimit(input: {
  perOrderAllocation: number | null | undefined;
  estimatedStopLossRisk: number | null | undefined;
}): PerOrderLossLimitResult {
  const alloc = input.perOrderAllocation;
  const risk = input.estimatedStopLossRisk;
  if (typeof alloc !== "number" || !Number.isFinite(alloc) || alloc <= 0) {
    return {
      ok: false,
      pass: false,
      perOrderAllocation: null,
      perOrderLossLimit: null,
      riskTargetAmount: null,
      allowedRiskAmount: null,
      estimatedStopLossRisk: typeof risk === "number" && Number.isFinite(risk) ? risk : null,
      code: "PER_ORDER_ALLOCATION_MISSING",
      message: "Per-order allocation required to compute risk target / hard maximum.",
    };
  }
  const breakdown = computePerOrderRiskBreakdown(alloc);
  if (typeof risk !== "number" || !Number.isFinite(risk) || risk < 0) {
    return {
      ok: false,
      pass: false,
      perOrderAllocation: alloc,
      perOrderLossLimit: breakdown.maximumPermittedOrderLoss,
      riskTargetAmount: breakdown.riskTargetAmount,
      allowedRiskAmount: breakdown.allowedRiskAmount,
      estimatedStopLossRisk: null,
      code: "PER_ORDER_LOSS_RISK_UNAVAILABLE",
      message: "Estimated Stop Loss risk unavailable — risk-limit check not fabricated.",
    };
  }
  if (risk > breakdown.maximumPermittedOrderLoss + 1e-8) {
    return {
      ok: true,
      pass: false,
      perOrderAllocation: alloc,
      perOrderLossLimit: breakdown.maximumPermittedOrderLoss,
      riskTargetAmount: breakdown.riskTargetAmount,
      allowedRiskAmount: breakdown.allowedRiskAmount,
      estimatedStopLossRisk: risk,
      code: "PER_ORDER_LOSS_LIMIT_EXCEEDED",
      message:
        `Estimated SL risk ${risk} exceeds hard maximum ${breakdown.maximumPermittedOrderLoss} `
        + `(${PER_ORDER_RISK_MAXIMUM_PERCENT}% of allocation ${alloc}).`,
    };
  }
  if (risk > breakdown.allowedRiskAmount + 1e-8) {
    return {
      ok: true,
      pass: false,
      perOrderAllocation: alloc,
      perOrderLossLimit: breakdown.maximumPermittedOrderLoss,
      riskTargetAmount: breakdown.riskTargetAmount,
      allowedRiskAmount: breakdown.allowedRiskAmount,
      estimatedStopLossRisk: risk,
      code: "PER_ORDER_RISK_TARGET_EXCEEDED",
      message:
        `Estimated SL risk ${risk} exceeds risk target ${breakdown.allowedRiskAmount} `
        + `(${PER_ORDER_RISK_TARGET_PERCENT}% of allocation ${alloc}). Hard max `
        + `${breakdown.maximumPermittedOrderLoss} is not permission to raise risk.`,
    };
  }
  return {
    ok: true,
    pass: true,
    perOrderAllocation: alloc,
    perOrderLossLimit: breakdown.maximumPermittedOrderLoss,
    riskTargetAmount: breakdown.riskTargetAmount,
    allowedRiskAmount: breakdown.allowedRiskAmount,
    estimatedStopLossRisk: risk,
    code: "PER_ORDER_LOSS_LIMIT_PASS",
    message:
      `Estimated SL risk ${risk} <= allowed risk ${breakdown.allowedRiskAmount} `
      + `(target ${PER_ORDER_RISK_TARGET_PERCENT}%, hard max ${PER_ORDER_RISK_MAXIMUM_PERCENT}% of ${alloc}).`,
  };
}
