/**
 * Phase 59.0 — Order Execution Engine contracts.
 * Builds an auditable DEMO request from analysis decision + simulation risk draft.
 * Never flips global placesOrders / acceptsForExecution. Never invents trades.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { DemoOpenMarketRequest } from "../demo-execution/types.js";

export const AT_ORDER_EXECUTION_SCHEMA = "at-order-execution-plan-v1";
export const AT_ORDER_EXECUTION_PHASE = "59.0";
export const AT_ORDER_EXECUTION_BANNER =
  "ORDER EXECUTION PLAN — PHASE 59.0 — GLOBAL placesOrders=false; DEMO mutation only via grant-scoped lifecycle";

/**
 * Local plan lifecycle (not broker states). Submission uses DemoLifecycleState.
 * Ambiguous broker outcomes remain SUBMISSION_UNKNOWN / RECONCILIATION_REQUIRED
 * on the DEMO lifecycle record — never auto-retried as failure.
 */
export const AT_EXECUTION_PLAN_STATUSES = [
  "REJECTED",
  "BLOCKED",
  "READY_FOR_DEMO_GRANT_SUBMISSION",
] as const;

export type AtExecutionPlanStatus = (typeof AT_EXECUTION_PLAN_STATUSES)[number];

export interface AtExecutionRejection {
  code: string;
  message: string;
}

export interface AtExecutionRiskAudit {
  sourceDraftId: string | null;
  draftOverallStatus: string | null;
  proposedQuantity: number | null;
  proposedQuantityNote: string | null;
  lots: number | null;
  lotsMethod: "FLOOR_PROPOSED_QUANTITY" | null;
  grantMaxLots: number | null;
  clampedToGrant: boolean;
  estimatedStopLossRisk: number | null;
  rewardRiskRatio: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  quoteFresh: boolean | null;
  note: string;
}

export interface AtExecutionPlan {
  schemaVersion: typeof AT_ORDER_EXECUTION_SCHEMA;
  phase: typeof AT_ORDER_EXECUTION_PHASE;
  planId: string;
  status: AtExecutionPlanStatus;
  createdAtUtc: string;
  sourceDecisionId: string | null;
  sourceAnalysisId: string | null;
  sourceDraftId: string | null;
  instrument: string | null;
  direction: AtBinaryDirection | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  proposedQuantity: number | null;
  lots: number | null;
  riskAudit: AtExecutionRiskAudit;
  /** Built only when status is READY_FOR_DEMO_GRANT_SUBMISSION. */
  demoRequest: DemoOpenMarketRequest | null;
  rejections: AtExecutionRejection[];
  /** Prepare never submits — always false here. */
  maySubmitDemoMutation: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  banner: typeof AT_ORDER_EXECUTION_BANNER;
  note: string;
}

/**
 * Map Phase 59 conceptual states → DemoLifecycleState / plan status.
 * Installed SDK cannot establish every conceptual state; aliases document intent.
 */
export const AT_EXECUTION_STATE_MAP = {
  RECEIVED: "plan accepted into prepare()",
  VALIDATING: "decision + draft + geometry + lots checks",
  REJECTED: "REJECTED | DemoLifecycle VALIDATION_FAILED / AUTHORIZATION_REJECTED",
  READY: "READY_FOR_DEMO_GRANT_SUBMISSION / DemoLifecycle READY_FOR_SUBMISSION",
  SUBMITTING: "DemoLifecycle SUBMITTING",
  SUBMITTED: "DemoLifecycle ACCEPTED_PENDING (broker ack without fill)",
  ACCEPTED: "DemoLifecycle ACCEPTED_PENDING",
  PARTIALLY_FILLED: "handled via remainingAmount on DemoLifecycleRecord",
  FILLED: "DemoLifecycle FILLED | POSITION_OPEN",
  PROTECTION_PENDING: "DemoLifecycle PROTECTION_PENDING",
  PROTECTED: "DemoLifecycle PROTECTED + protectionStatus BROKER_CONFIRMED",
  CANCEL_PENDING: "DemoLifecycle CANCEL_PENDING",
  CANCELLED: "DemoLifecycle CANCELLED",
  CLOSE_PENDING: "DemoLifecycle CLOSE_PENDING",
  CLOSED: "DemoLifecycle CLOSED | PARTIALLY_CLOSED",
  FAILED: "DemoLifecycle BROKER_REJECTED | PROTECTION_FAILED | MUTATION_DISABLED",
  UNKNOWN_REQUIRES_RECONCILIATION:
    "DemoLifecycle SUBMISSION_UNKNOWN | RECONCILIATION_REQUIRED — do not blind-retry",
} as const;
