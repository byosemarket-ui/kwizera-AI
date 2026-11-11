/**
 * Phase 4.18 — Automated Trading system notification event schema.
 * Informational only. Never mutates broker state or safety gates.
 */

export const AT_NOTIFICATION_PHASE = "4.18" as const;
export const AT_NOTIFICATION_SCHEMA = 1 as const;

export type AtNotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "CRITICAL";

export type AtNotificationCategory =
  | "FOREXCONNECT"
  | "MARKET_DATA"
  | "STRATEGY"
  | "RISK"
  | "WORKER"
  | "EXECUTION_LIFECYCLE"
  | "SYSTEM";

/** Catalog of supported event type codes (definitions may exist before emitters). */
export type AtNotificationEventType =
  // ForexConnect
  | "FC_CONNECTION_ESTABLISHED"
  | "FC_CONNECTION_LOST"
  | "FC_RECONNECTION_SUCCESSFUL"
  | "FC_AUTHENTICATION_FAILURE"
  | "FC_SIDECAR_UNAVAILABLE"
  | "FC_GATEWAY_UNAVAILABLE"
  // Market data
  | "MD_INSTRUMENT_SUBSCRIBED"
  | "MD_SUBSCRIPTION_FAILED"
  | "MD_SNAPSHOT_RECEIVED"
  | "MD_GENUINE_PRICE_CHANGES_DETECTED"
  | "MD_MARKET_INACTIVE"
  | "MD_QUOTE_STALE"
  | "MD_HISTORICAL_UNAVAILABLE"
  | "MD_INVALID_CANDLE_DATA"
  // Strategy
  | "STRAT_ANALYSIS_STARTED"
  | "STRAT_ANALYSIS_COMPLETED"
  | "STRAT_SIGNAL_BUY"
  | "STRAT_SIGNAL_SELL"
  | "STRAT_NO_SIGNAL"
  | "STRAT_ANALYSIS_FAILED"
  | "STRAT_INSUFFICIENT_CANDLES"
  | "STRAT_INVALID_INPUT"
  // Risk
  | "RISK_DAILY_CHECK_PASSED"
  | "RISK_LIMIT_REACHED"
  | "RISK_MAX_TRADE_SIZE_EXCEEDED"
  | "RISK_MARGIN_UNAVAILABLE"
  | "RISK_MARGIN_PREFLIGHT_BLOCKED"
  | "RISK_QUANTITY_INCOMPATIBLE_OWNER_LIMIT"
  | "RISK_EXECUTION_FORBIDDEN"
  // Worker
  | "WORKER_STARTED"
  | "WORKER_STOPPED"
  | "WORKER_HEARTBEAT"
  | "WORKER_HEARTBEAT_STALE"
  | "WORKER_TICK_FAILED"
  | "WORKER_LOCK_CONFLICT"
  | "WORKER_RECOVERY_SUCCESS"
  // Future execution lifecycle (definitions only unless genuine/sim labeled)
  | "EXEC_ORDER_REQUESTED"
  | "EXEC_ORDER_ACCEPTED"
  | "EXEC_ORDER_REJECTED"
  | "EXEC_PARTIAL_FILL"
  | "EXEC_FULL_FILL"
  | "EXEC_POSITION_OPENED"
  | "EXEC_SL_CONFIRMED"
  | "EXEC_TP_CONFIRMED"
  | "EXEC_POSITION_CLOSED"
  // System
  | "SYSTEM_GENERIC";

export interface AtSystemNotification {
  schemaVersion: typeof AT_NOTIFICATION_SCHEMA;
  phase: typeof AT_NOTIFICATION_PHASE;
  id: string;
  eventType: AtNotificationEventType;
  category: AtNotificationCategory;
  severity: AtNotificationSeverity;
  title: string;
  message: string;
  /** Safe technical detail — never secrets. */
  detail: string | null;
  instrument: string | null;
  provider: "FOREXCONNECT" | null;
  sourceComponent: string;
  createdAtUtc: string;
  read: boolean;
  archived: boolean;
  readAtUtc: string | null;
  archivedAtUtc: string | null;
  /** Deduplication key used at emit time. */
  dedupeKey: string;
  /** True when created from tests or operator simulation. */
  simulated: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  metadata: Record<string, unknown>;
}

export interface AtNotificationEmitInput {
  eventType: AtNotificationEventType;
  title: string;
  message: string;
  detail?: string | null;
  instrument?: string | null;
  sourceComponent: string;
  severity?: AtNotificationSeverity;
  category?: AtNotificationCategory;
  dedupeKey?: string;
  dedupeTtlMs?: number;
  simulated?: boolean;
  metadata?: Record<string, unknown>;
  nowMs?: number;
}

export interface AtNotificationListQuery {
  category?: AtNotificationCategory | null;
  severity?: AtNotificationSeverity | null;
  unreadOnly?: boolean;
  includeArchived?: boolean;
  search?: string | null;
  instrument?: string | null;
  offset?: number;
  limit?: number;
}

export interface AtNotificationListResult {
  ok: true;
  total: number;
  unreadCount: number;
  offset: number;
  limit: number;
  notifications: AtSystemNotification[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}
