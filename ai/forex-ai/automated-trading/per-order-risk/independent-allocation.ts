/**
 * Stage 1 Part 1 — Independent per-order allocation isolation helpers.
 * Pure functions. Never pool risk budgets across orders. Never mutate broker.
 */
import {
  allocatePerOrderFromRemaining,
  computeAllowedRiskAmount,
  computePerOrderLossLimit,
  computePerOrderRiskBreakdown,
  computePerOrderRiskTarget,
} from "../simulation-risk/capital-budget.js";
import {
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
  RISK_POLICY_ID,
  RISK_POLICY_VERSION,
} from "../order-proposal/types.js";

export interface IndependentOrderAllocationSpec {
  /** Stable identity for this order's allocation (never shared). */
  allocationId: string;
  /** Explicit monetary allocation for this order only. */
  orderAllocation: number;
  instrument?: string | null;
}

export interface IndependentOrderRiskBudget {
  allocationId: string;
  orderAllocation: number;
  instrument: string | null;
  riskTargetPercent: typeof PER_ORDER_RISK_TARGET_PERCENT;
  riskMaximumPercent: typeof PER_ORDER_RISK_MAXIMUM_PERCENT;
  targetRiskAmount: number;
  hardMaximumModeledLoss: number;
  allowedRiskAmount: number;
  riskPolicyId: typeof RISK_POLICY_ID;
  riskPolicyVersion: typeof RISK_POLICY_VERSION;
  /** Explicit: this budget must not be consumed by any other allocationId. */
  mayBorrowFromOtherOrders: false;
  mayLendUnusedRiskToOtherOrders: false;
}

/**
 * Build an isolated risk budget from a single order's allocation.
 * Never reads other orders' unused risk.
 */
export function buildIndependentOrderRiskBudget(
  spec: IndependentOrderAllocationSpec,
): IndependentOrderRiskBudget {
  const orderAllocation = Number(spec.orderAllocation);
  if (!Number.isFinite(orderAllocation) || orderAllocation <= 0) {
    throw new Error("orderAllocation must be a finite positive number");
  }
  const breakdown = computePerOrderRiskBreakdown(orderAllocation);
  return {
    allocationId: String(spec.allocationId || "").trim() || "unassigned",
    orderAllocation,
    instrument: spec.instrument ?? null,
    riskTargetPercent: PER_ORDER_RISK_TARGET_PERCENT,
    riskMaximumPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
    targetRiskAmount: breakdown.riskTargetAmount,
    hardMaximumModeledLoss: breakdown.maximumPermittedOrderLoss,
    allowedRiskAmount: breakdown.allowedRiskAmount,
    riskPolicyId: RISK_POLICY_ID,
    riskPolicyVersion: RISK_POLICY_VERSION,
    mayBorrowFromOtherOrders: false,
    mayLendUnusedRiskToOtherOrders: false,
  };
}

/**
 * Prove N simultaneous order budgets remain isolated:
 * - sum(allowedRisk) === sum(individual allowedRisk)
 * - no budget references another allocation's unused remainder
 */
export function assertIndependentRiskBudgets(
  specs: IndependentOrderAllocationSpec[],
): {
  ok: true;
  budgets: IndependentOrderRiskBudget[];
  sumAllowedRisk: number;
  sumHardMax: number;
  isolationNote: string;
} {
  const budgets = specs.map(buildIndependentOrderRiskBudget);
  const sumAllowedRisk = budgets.reduce((s, b) => s + b.allowedRiskAmount, 0);
  const sumHardMax = budgets.reduce((s, b) => s + b.hardMaximumModeledLoss, 0);
  const ids = new Set(budgets.map((b) => b.allocationId));
  if (ids.size !== budgets.length) {
    throw new Error("allocationId values must be unique across simultaneous orders");
  }
  return {
    ok: true,
    budgets,
    sumAllowedRisk,
    sumHardMax,
    isolationNote:
      "Each allowedRiskAmount = that order's allocation × 0.25 only. "
      + "Unused risk on one order cannot increase another order's ceiling.",
  };
}

/**
 * Strategy-budget reservation path: each requested allocation is checked against
 * remaining strategy capital independently. Portfolio exposure control stays separate.
 */
export function reserveIndependentAllocations(input: {
  capitalAllocationBudget: number;
  requests: Array<{ allocationId: string; orderAllocation: number }>;
}):
  | {
    ok: true;
    reserved: Array<{
      allocationId: string;
      orderAllocation: number;
      remainingAfter: number;
      riskBudget: IndependentOrderRiskBudget;
    }>;
  }
  | { ok: false; code: string; message: string; failedAllocationId: string | null } {
  let reservedActive = 0;
  const reserved: Array<{
    allocationId: string;
    orderAllocation: number;
    remainingAfter: number;
    riskBudget: IndependentOrderRiskBudget;
  }> = [];

  for (const req of input.requests) {
    const step = allocatePerOrderFromRemaining({
      capitalAllocationBudget: input.capitalAllocationBudget,
      reservedActive,
      requestedPerOrderAllocation: req.orderAllocation,
    });
    if (!step.ok) {
      return {
        ok: false,
        code: step.code,
        message: step.message,
        failedAllocationId: req.allocationId,
      };
    }
    reservedActive += step.perOrderAllocation;
    reserved.push({
      allocationId: req.allocationId,
      orderAllocation: step.perOrderAllocation,
      remainingAfter: step.remainingAfter,
      riskBudget: buildIndependentOrderRiskBudget({
        allocationId: req.allocationId,
        orderAllocation: step.perOrderAllocation,
      }),
    });
  }

  return { ok: true, reserved };
}

export {
  computeAllowedRiskAmount,
  computePerOrderLossLimit,
  computePerOrderRiskTarget,
};
