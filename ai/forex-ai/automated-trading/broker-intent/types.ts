/**
 * Phase 57.0 — Broker order-intent architecture (DEMO prep only).
 * Never places, amends, cancels, or closes broker orders.
 * Local intent ≠ broker acknowledgment ≠ fill ≠ protection.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";

export const BROKER_INTENT_SCHEMA = "at-broker-intent-v1" as const;
export const BROKER_INTENT_PHASE = "57.0" as const;

export const BROKER_INTENT_BANNER =
  "BROKER INTENT ARCHITECTURE ONLY — PHASE 57.0 — EXECUTION REMAINS FORBIDDEN" as const;

/** Explicit ForexConnect / AT capability stamps (architecture, not permission). */
export type BrokerCapability =
  | "READ_ONLY_MARKET_DATA"
  | "READ_ONLY_ACCOUNT_STATE"
  | "READ_ONLY_ORDERS"
  | "READ_ONLY_POSITIONS"
  | "ORDER_SUBMISSION_DISABLED"
  | "ORDER_MODIFICATION_DISABLED"
  | "ORDER_CANCELLATION_DISABLED"
  | "POSITION_CLOSURE_DISABLED"
  | "PROTECTIVE_ORDER_MUTATION_DISABLED";

/**
 * Intent lifecycle for this phase. Production must not enter submission/fill states.
 * Future states are documented for a separately authorized phase only.
 */
export type BrokerIntentLifecycleState =
  | "DRAFT"
  | "VALIDATING"
  | "BLOCKED"
  | "READY_FOR_AUTHORIZATION"
  | "AUTHORIZATION_REQUIRED"
  | "EXECUTION_DISABLED";

/** Documented future states — never entered by Phase 57.0 production code. */
export type BrokerIntentFutureLifecycleState =
  | "SUBMISSION_PENDING"
  | "BROKER_ACKNOWLEDGED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "REJECTED_BY_BROKER"
  | "CANCELLED"
  | "EXPIRED"
  | "RECONCILIATION_MISMATCH"
  | "UNKNOWN_BROKER_OUTCOME";

export type ProtectiveOrderStatus =
  | "LOCAL_CALCULATED_ONLY"
  | "REQUESTED_NOT_SUBMITTED"
  | "BROKER_ACK_UNKNOWN"
  | "BROKER_OBSERVED"
  | "PROTECTION_UNVERIFIED"
  | "PROTECTION_CAPABILITY_UNVERIFIED";

export type BrokerIntentRejectionCode =
  | "EXECUTION_FORBIDDEN"
  | "DEMO_ENVIRONMENT_UNVERIFIED"
  | "ACCOUNT_STATE_UNVERIFIED"
  | "INSTRUMENT_NOT_ALLOWED"
  | "CONTRACT_SIZE_UNVERIFIED"
  | "QUANTITY_UNIT_AMBIGUOUS"
  | "QUOTE_STALE"
  | "QUOTE_MISSING"
  | "STOP_LOSS_REQUIRED"
  | "TAKE_PROFIT_REQUIRED"
  | "STOP_LOSS_GEOMETRY_INVALID"
  | "TAKE_PROFIT_GEOMETRY_INVALID"
  | "TP_NOT_3R"
  | "RISK_LIMIT_EXCEEDED"
  | "DUPLICATE_INTENT"
  | "PROTECTION_CAPABILITY_UNVERIFIED"
  | "BROKER_STATE_RECONCILIATION_REQUIRED"
  | "AUTHORIZATION_REQUIRED"
  | "MASTER_TRADING_OFF_REQUIRED"
  | "EMERGENCY_LOCK_ON_REQUIRED"
  | "LIVE_EXECUTION_UNAUTHORIZED"
  | "DIRECTION_MISSING"
  | "ENTRY_PRICE_INVALID"
  | "QUANTITY_INVALID"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "INTENT_MUTATED_REVALIDATE";

export interface BrokerIntentRejection {
  code: BrokerIntentRejectionCode;
  message: string;
}

export interface BrokerIntentRiskEnvelope {
  strategyAllocationPercent: number | null;
  perOrderAllocation: number | null;
  estimatedSlLossAccount: number | null;
  maxSlLossFractionOfAllocation: 0.25;
  rewardRiskTarget: 3;
  allocationOk: boolean | null;
  riskLimitOk: boolean | null;
}

export interface BrokerIntentRecord {
  schemaVersion: typeof BROKER_INTENT_SCHEMA;
  phase: typeof BROKER_INTENT_PHASE;
  intentId: string;
  idempotencyKey: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  environment: "DEMO" | "LIVE";
  /** Redacted account reference only — never raw credentials. */
  accountIdMasked: string | null;
  instrument: string;
  direction: AtBinaryDirection | null;
  quantity: number | null;
  quantityUnit: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  contractSizeVerified: boolean;
  pointSize: number | null;
  sourceDraftId: string | null;
  sourceDecisionId: string | null;
  risk: BrokerIntentRiskEnvelope;
  state: BrokerIntentLifecycleState;
  rejections: BrokerIntentRejection[];
  authorizationGranted: false;
  authorizationExpiresAtUtc: null;
  /** Never invent broker IDs in this phase. */
  brokerOrderId: null;
  brokerDealId: null;
  brokerPositionId: null;
  protectiveStatus: ProtectiveOrderStatus;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  intentOnly: true;
  executionDisabled: true;
  note: string;
}

export interface BrokerCapabilityMatrix {
  phase: typeof BROKER_INTENT_PHASE;
  capabilities: Record<BrokerCapability, boolean>;
  tradingEnabled: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface BrokerIntentPublicStatus {
  phase: typeof BROKER_INTENT_PHASE;
  banner: typeof BROKER_INTENT_BANNER;
  intentCount: number;
  latest: BrokerIntentRecord | null;
  history: BrokerIntentRecord[];
  capabilities: BrokerCapabilityMatrix;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionDisabled: true;
  note: string;
}

export interface BrokerRoObservation {
  observedAtUtc: string;
  openOrdersCount: number | null;
  openPositionsCount: number | null;
  ordersCapability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  tradesCapability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  /** Never invent identifiers — only pass through when observed. */
  observedOrderIds: string[];
  observedPositionIds: string[];
  placesOrders: false;
  mutatesBroker: false;
}

export type ReconcileOutcomeCode =
  | "NO_INTENT"
  | "INTENT_ONLY_NO_BROKER_EVIDENCE"
  | "BROKER_ACK_NOT_FILL"
  | "PARTIAL_FILL_REQUIRES_AUTHORIZED_PHASE"
  | "FULL_FILL_REQUIRES_AUTHORIZED_PHASE"
  | "PROTECTION_UNVERIFIED"
  | "RECONCILIATION_MISMATCH"
  | "UNKNOWN_BROKER_OUTCOME"
  | "EXECUTION_FORBIDDEN";

export interface BrokerReconcileResult {
  intentId: string | null;
  outcome: ReconcileOutcomeCode;
  message: string;
  inferredFill: false;
  inferredProtection: false;
  placesOrders: false;
  mutatesBroker: false;
  detail: string;
}
