/**
 * Phase 58.1 — DEMO-only lifecycle execution types.
 * Distinct from global placesOrders / acceptsForExecution (remain false for AT automation).
 */

export const DEMO_LIFECYCLE_STATES = [
  "IDLE",
  "GRANT_ACTIVE",
  "VALIDATION_FAILED",
  "AUTHORIZATION_REJECTED",
  "ENVIRONMENT_MISMATCH",
  "MUTATION_DISABLED",
  "READY_FOR_SUBMISSION",
  "SUBMITTING",
  "SUBMISSION_UNKNOWN",
  "BROKER_REJECTED",
  "ACCEPTED_PENDING",
  "FILLED",
  "POSITION_OPEN",
  "PROTECTION_PENDING",
  "PROTECTED",
  "PROTECTION_UNSUPPORTED",
  "CLOSE_PENDING",
  "CLOSED",
  "RECONCILIATION_REQUIRED",
  "EXECUTION_DISABLED",
] as const;

export type DemoLifecycleState = (typeof DEMO_LIFECYCLE_STATES)[number];

export interface DemoExecutionGrant {
  grantId: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  revokedAtUtc: string | null;
  /** Masked DEMO account hint from grant creation — not a secret. */
  accountIdMasked: string | null;
  instrumentAllowlist: string[];
  maxLots: number;
  createdBy: "admin";
  purpose: "PHASE_58_1_DEMO_LIFECYCLE";
  /** LIVE is never permitted. */
  environment: "DEMO";
}

export interface DemoOpenMarketRequest {
  grantId: string;
  instrument: string;
  direction: "BUY" | "SELL";
  lots: number;
  accountId?: string | null;
  requireProtective: boolean;
  idempotencyKey: string;
}

export interface DemoCloseTradeRequest {
  grantId: string;
  tradeId: string;
  instrument?: string | null;
  accountId?: string | null;
  idempotencyKey: string;
}

export interface DemoLifecycleRecord {
  lifecycleId: string;
  state: DemoLifecycleState;
  grantId: string | null;
  intentId: string | null;
  idempotencyKey: string;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  lots: number | null;
  brokerOrderId: string | null;
  tradeId: string | null;
  closeOrderId: string | null;
  fillConfirmed: boolean;
  closeConfirmed: boolean;
  protectionStatus: "NOT_REQUESTED" | "UNSUPPORTED" | "PENDING" | "LOCAL_ONLY" | "BROKER_UNVERIFIED";
  lastError: string | null;
  lastCode: string | null;
  mutatesBroker: boolean;
  placesOrdersGlobal: false;
  acceptsForExecutionGlobal: false;
  createdAtUtc: string;
  updatedAtUtc: string;
  evidence: Record<string, unknown>;
}
