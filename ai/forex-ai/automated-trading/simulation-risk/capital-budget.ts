/**
 * Phase 56.2.3 — Strategy capital allocation (1–100% of equity) and per-order 25% loss limit.
 * Strategy budget ≠ broker margin ≠ estimated SL risk.
 */
export const STRATEGY_ALLOCATION_PCT_MIN = 1;
export const STRATEGY_ALLOCATION_PCT_MAX = 100;
export const PER_ORDER_LOSS_LIMIT_FRACTION = 0.25;

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
    capitalAllocationBudget: verifiedEquity * (capitalAllocationPercent / 100),
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
  let perOrder: number;
  if (requested == null) {
    // Default: do not auto-consume the entire remaining budget for one order.
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
  perOrder = requested;
  return {
    ok: true,
    perOrderAllocation: perOrder,
    remainingBefore,
    remainingAfter: remainingBefore - perOrder,
  };
}

export function computePerOrderLossLimit(perOrderAllocation: number): number {
  return perOrderAllocation * PER_ORDER_LOSS_LIMIT_FRACTION;
}

export type PerOrderLossLimitResult =
  | {
    ok: true;
    pass: boolean;
    perOrderAllocation: number;
    perOrderLossLimit: number;
    estimatedStopLossRisk: number;
    code: "PER_ORDER_LOSS_LIMIT_PASS" | "PER_ORDER_LOSS_LIMIT_EXCEEDED";
    message: string;
  }
  | {
    ok: false;
    pass: false;
    perOrderAllocation: number | null;
    perOrderLossLimit: number | null;
    estimatedStopLossRisk: number | null;
    code: string;
    message: string;
  };

/**
 * estimatedStopLossRisk <= perOrderAllocation * 0.25
 * Equality within 1e-8 passes.
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
      estimatedStopLossRisk: typeof risk === "number" && Number.isFinite(risk) ? risk : null,
      code: "PER_ORDER_ALLOCATION_MISSING",
      message: "Per-order allocation required to compute 25% loss limit.",
    };
  }
  if (typeof risk !== "number" || !Number.isFinite(risk) || risk < 0) {
    return {
      ok: false,
      pass: false,
      perOrderAllocation: alloc,
      perOrderLossLimit: computePerOrderLossLimit(alloc),
      estimatedStopLossRisk: null,
      code: "PER_ORDER_LOSS_RISK_UNAVAILABLE",
      message: "Estimated Stop Loss risk unavailable — 25% loss-limit check not fabricated.",
    };
  }
  const limit = computePerOrderLossLimit(alloc);
  const pass = risk <= limit + 1e-8;
  return {
    ok: true,
    pass,
    perOrderAllocation: alloc,
    perOrderLossLimit: limit,
    estimatedStopLossRisk: risk,
    code: pass ? "PER_ORDER_LOSS_LIMIT_PASS" : "PER_ORDER_LOSS_LIMIT_EXCEEDED",
    message: pass
      ? `Estimated SL risk ${risk} <= per-order loss limit ${limit} (25% of allocation ${alloc}).`
      : `Estimated SL risk ${risk} exceeds per-order loss limit ${limit} (25% of allocation ${alloc}).`,
  };
}
