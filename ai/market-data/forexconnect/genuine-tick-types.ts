/**
 * Phase 4.18F.2.2 — Genuine ForexConnect Offers tick capture types.
 * Read-only market data; never places orders.
 */

export const GENUINE_TICK_SCHEMA = "kwizera.fc-genuine-tick.v1" as const;
export const MOVEMENT_WINDOWS_SCHEMA = "kwizera.fc-movement-windows.v1" as const;

export type GenuineTickEventClass =
  | "BID_ASK_CHANGE"
  | "BID_CHANGE"
  | "ASK_CHANGE"
  | "INITIAL_SNAPSHOT"
  | "IDENTICAL_SNAPSHOT"
  | "HEARTBEAT"
  | "STALE_UPDATE"
  | "DISCONNECTED"
  | "INVALID_QUOTE";

export type MovementDirection = "UP" | "DOWN" | "FLAT" | "UNKNOWN";

export type MovementWindowId = "1m" | "5m" | "15m" | "30m" | "60m";

export const MOVEMENT_WINDOW_MS: Record<MovementWindowId, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "60m": 3_600_000,
};

export const MOVEMENT_WINDOW_IDS: MovementWindowId[] = ["1m", "5m", "15m", "30m", "60m"];

/** Accepted genuine tick only — snapshots/heartbeats are never persisted as ticks. */
export interface GenuineTickRecord {
  schemaVersion: typeof GENUINE_TICK_SCHEMA;
  instrument: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  previousBid: number;
  previousAsk: number;
  /** Provider event time when supplied; otherwise null (never invent). */
  eventTimestampMs: number | null;
  /** Local receipt time from Offers path. */
  receiptTimestampMs: number;
  source: string;
  eventClass: "BID_ASK_CHANGE" | "BID_CHANGE" | "ASK_CHANGE";
  /** Dedup identity: instrument|receipt|bid|ask */
  dedupeId: string;
  sequence: number;
  quality: "OK" | "DEGRADED";
}

export interface TickCaptureCounters {
  received: number;
  accepted: number;
  filtered: number;
  persisted: number;
  duplicates: number;
  persistenceFailures: number;
  processingFailures: number;
  lastAcceptedAtMs: number | null;
  lastPersistedAtMs: number | null;
  lastFilteredClass: GenuineTickEventClass | null;
}

export interface MovementWindowSummary {
  schemaVersion: typeof MOVEMENT_WINDOWS_SCHEMA;
  windowId: MovementWindowId;
  windowMs: number;
  instrument: string;
  genuineTickCount: number;
  firstBid: number | null;
  firstAsk: number | null;
  latestBid: number | null;
  latestAsk: number | null;
  highestBid: number | null;
  lowestBid: number | null;
  highestAsk: number | null;
  lowestAsk: number | null;
  firstReceiptTimestampMs: number | null;
  latestReceiptTimestampMs: number | null;
  netBidMovement: number | null;
  netAskMovement: number | null;
  midPriceMovement: number | null;
  percentageMovement: number | null;
  direction: MovementDirection;
  averageMovementPerChange: number | null;
  largestObservedMovement: number | null;
  currentSpread: number | null;
  averageSpread: number | null;
  spreadChange: number | null;
  coverage: "FULL" | "PARTIAL" | "EMPTY";
  freshness: "LIVE" | "STALE" | "NO_GENUINE_TICKS" | "INSUFFICIENT_DATA" | "DISCONNECTED";
  status: "OK" | "NO_GENUINE_TICKS" | "INSUFFICIENT_DATA" | "STALE";
  asOfMs: number;
}

export interface TickCaptureHealth {
  ok: boolean;
  schemaVersion: typeof GENUINE_TICK_SCHEMA;
  storePath: string;
  counters: TickCaptureCounters;
  instrumentCount: number;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}
