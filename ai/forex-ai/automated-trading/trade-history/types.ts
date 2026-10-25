/**
 * Phase 60.0.3 — Durable broker-confirmed trade lifecycle records (read-only).
 * Never invents prices, P/L, or close events.
 */

export const TRADE_HISTORY_SCHEMA_VERSION = "60.0.3" as const;

export type TradeHistoryLifecycleStatus = "OPEN" | "CLOSED";

export interface TradeHistoryRecord {
  /** Stable key: environment|accountMasked|tradeId */
  recordKey: string;
  schemaVersion: typeof TRADE_HISTORY_SCHEMA_VERSION;
  environment: string;
  accountIdMasked: string | null;
  tradeId: string;
  orderId: string | null;
  instrument: string | null;
  offerId: string | null;
  side: string | null;
  amount: number | null;
  openRate: number | null;
  closeRate: number | null;
  openTime: string | null;
  closeTime: string | null;
  grossPl: number | null;
  commission: number | null;
  rolloverInterest: number | null;
  netPl: number | null;
  plBasis: "gross" | null;
  lifecycleStatus: TradeHistoryLifecycleStatus;
  /** Broker table source of the last confirmed update. */
  source: "forexconnect-trades" | "forexconnect-closed-trades";
  sourceTimestamp: string | null;
  observedAtUtc: string;
  updatedAtUtc: string;
  historyScopeNote: string;
}

export interface TradeHistoryFile {
  schemaVersion: typeof TRADE_HISTORY_SCHEMA_VERSION;
  provider: "FOREXCONNECT";
  /** Earliest observedAtUtc among persisted records — coverage start, not broker birth. */
  historyAvailableFromUtc: string | null;
  updatedAtUtc: string;
  records: TradeHistoryRecord[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

export interface TradeHistoryQuery {
  fromUtc?: string | null;
  toUtc?: string | null;
  instrument?: string | null;
  direction?: string | null;
  status?: TradeHistoryLifecycleStatus | "ALL" | null;
  /** When set, only records for this environment (DEMO/LIVE/…) — never merge across envs. */
  environment?: string | null;
  /** When set, only this masked account — never merge across accounts. */
  accountIdMasked?: string | null;
  limit?: number;
  offset?: number;
}

export interface TradeHistoryQueryResult {
  ok: true;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  historyAvailableFromUtc: string | null;
  coverageNote: string;
  total: number;
  limit: number;
  offset: number;
  records: TradeHistoryRecord[];
}
