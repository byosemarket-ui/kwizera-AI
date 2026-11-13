/**
 * XAU/USD Automated Trading — single active position lock (types).
 * Scope: XAU/USD Automated Trading only. Read-only broker observation; never mutates the broker.
 */

export const XAU_POSITION_LOCK_SCHEMA = "at-xau-position-lock-v1" as const;
export const XAU_POSITION_LOCK_INSTRUMENT = "XAU/USD" as const;

export type XauLockState =
  | "AVAILABLE"
  | "RESERVED"
  | "SUBMISSION_PENDING"
  | "POSITION_OPEN"
  | "POSITION_CLOSING"
  | "RECONCILIATION_PENDING"
  | "EXTERNAL_POSITION_BLOCK"
  | "UNKNOWN_BROKER_STATE";

export type XauPositionOwnership = "AUTOMATED" | "EXTERNAL" | "UNKNOWN";

export type XauSubmissionState = "NONE" | "PENDING" | "ACKNOWLEDGED" | "REJECTED" | "UNKNOWN_OUTCOME";

export type XauBrokerEvidenceStatus = "CONFIRMED_FLAT" | "OCCUPIED" | "UNKNOWN";

export type XauLockBlockCode =
  | "POSITION_LOCK_HELD"
  | "XAU_POSITION_ALREADY_OPEN"
  | "EXTERNAL_XAU_POSITION_PRESENT"
  | "XAU_PENDING_ORDER_PRESENT"
  | "BROKER_STATE_UNKNOWN"
  | "POSITION_RECONCILIATION_REQUIRED"
  | "RISK_BREACH_ENTRY_FREEZE"
  | "ACCOUNT_IDENTITY_UNVERIFIED"
  | "POSITION_LOCK_STORE_UNAVAILABLE";

export interface XauBrokerPositionRow {
  tradeId: string | null;
  orderId: string | null;
  instrument: string | null;
  offerId: string | null;
  side: string | null;
  amount: number | null;
  openRate: number | null;
  currentPrice: number | null;
  floatingPl: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  usedMargin: number | null;
  openTime: string | null;
  ownership: XauPositionOwnership;
}

export interface XauPendingOrderRow {
  orderId: string | null;
  instrument: string | null;
  side: string | null;
  amount: number | null;
  rate: number | null;
  status: string | null;
  ownership: XauPositionOwnership;
}

export interface XauBrokerEvidence {
  status: XauBrokerEvidenceStatus;
  observedAtUtc: string;
  fetchedAtUtc: string | null;
  freshnessMs: number | null;
  positions: XauBrokerPositionRow[];
  pendingOrders: XauPendingOrderRow[];
  /** Rows whose instrument could not be identified (fail-closed → UNKNOWN). */
  unidentifiedRows: number;
  closedTradeIds: string[];
  accountBindingHash: string | null;
  reasonCodes: string[];
  readOnly: true;
}

export interface XauLockReservation {
  reservationId: string;
  proposalId: string;
  idempotencyKey: string;
  riskDecisionId: string | null;
  accountBindingHash: string | null;
  accountRiskSnapshotId: string | null;
  maxRiskAccountCurrency: number | null;
  accountCurrency: string | null;
  reservedAtUtc: string;
  expiresAtUtc: string;
}

export interface XauLockEvent {
  atUtc: string;
  type: string;
  from: XauLockState | null;
  to: XauLockState | null;
  code: string | null;
  detail: string;
}

export interface XauEntryFreeze {
  active: boolean;
  reason: string | null;
  raisedAtUtc: string | null;
  tradeId: string | null;
  observedLossAccountCurrency: number | null;
  maxRiskAccountCurrency: number | null;
  acknowledgedAtUtc: string | null;
  acknowledgedBy: string | null;
}

export interface XauPositionLockRecord {
  schemaVersion: typeof XAU_POSITION_LOCK_SCHEMA;
  instrument: typeof XAU_POSITION_LOCK_INSTRUMENT;
  state: XauLockState;
  stateVersion: number;
  /** State to resume reconciliation from after UNKNOWN_BROKER_STATE. */
  priorState: XauLockState | null;
  reservation: XauLockReservation | null;
  submission: {
    state: XauSubmissionState;
    requestId: string | null;
    brokerOrderId: string | null;
    brokerTradeId: string | null;
    updatedAtUtc: string | null;
  };
  trackedTradeIds: string[];
  trackedOrderIds: string[];
  flatConfirmations: { count: number; firstAtUtc: string | null };
  lastReconciliationAtUtc: string | null;
  lastEvidence: {
    status: XauBrokerEvidenceStatus;
    observedAtUtc: string;
    positions: XauBrokerPositionRow[];
    pendingOrders: XauPendingOrderRow[];
    reasonCodes: string[];
  } | null;
  lastReleaseReason: string | null;
  lastReleasedAtUtc: string | null;
  lastReleaseEvidence: string | null;
  entryFreeze: XauEntryFreeze;
  idempotency: Record<string, { proposalId: string; reservationId: string | null; outcome: string; atUtc: string }>;
  events: XauLockEvent[];
  updatedAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

export function isLockHeld(state: XauLockState): boolean {
  return state !== "AVAILABLE";
}
