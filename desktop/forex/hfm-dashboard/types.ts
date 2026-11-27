/** HFM MT5 Dashboard — Phase 2 types (mirror Phase 1 SSE envelope; no secrets). */

export type HfmFreshness =
  | "LIVE"
  | "STALE"
  | "WAITING_FOR_DATA"
  | "DISCONNECTED"
  | "MARKET_CLOSED"
  | "DATA_UNAVAILABLE";

export type HfmConnectionState = "connected" | "degraded" | "disconnected" | "waiting";

export type HfmSseEventType =
  | "hello"
  | "snapshot"
  | "account"
  | "quote"
  | "candles"
  | "state"
  | "heartbeat"
  | "error"
  | "subscription"
  | "freshness"
  | "recovery";

export type HfmCandleTf =
  | "M1"
  | "M3"
  | "M5"
  | "M15"
  | "M30"
  | "H1"
  | "H2"
  | "H4"
  | "H6"
  | "H12"
  | "D1"
  | "W1";

export const HFM_CANDLE_TFS: HfmCandleTf[] = [
  "M1",
  "M3",
  "M5",
  "M15",
  "M30",
  "H1",
  "H2",
  "H4",
  "H6",
  "H12",
  "D1",
  "W1",
];
export const HFM_CHART_SYMBOLS = ["EURUSD", "XAUUSD"] as const;
export type HfmChartSymbol = (typeof HFM_CHART_SYMBOLS)[number];

export interface HfmEventEnvelope<T = unknown> {
  v: 1;
  schemaVersion?: string;
  broker: "HFM_MT5";
  environment: "demo";
  type: HfmSseEventType;
  eventId: string;
  seq: number | null;
  correlationId?: string | null;
  brokerTimestamp: number | null;
  occurredAt?: string;
  serverReceivedAt: string;
  publishedAt: string;
  freshness: HfmFreshness;
  connectionState: HfmConnectionState;
  provenance: string;
  validation: string;
  data: T;
}

export interface HfmAccountState {
  loginExact: string | null;
  loginHint: string | null;
  server: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  freeMargin: number | null;
  usedMargin: number | null;
  marginLevel: number | null;
  leverage: string | number | null;
  openPositionsCount: number | null;
  pendingOrdersCount: number | null;
  connectionStatus: string | null;
  company: string | null;
}

export interface HfmQuoteState {
  symbol: string;
  bid: number;
  ask: number;
  last: number | null;
  spread: number | null;
  digits: number | null;
  point: number | null;
  tickTime: number | null;
  tickVolume: number | null;
  /** Broker/hub sequence when present — used to reject older ticks. */
  sequence: number | null;
  /** Client receive time (ms) for REST/SSE reconciliation. */
  receivedAtMs: number | null;
  freshness: HfmFreshness;
  /** Canonical quote status from STEP 2A when present. */
  status: string | null;
  /** Prior mid for UI direction only — never shown as broker 24h change. */
  prevMid: number | null;
}

export interface HfmCandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume?: number;
  realVolume?: number;
  spread?: number;
}

export type HfmCandleMap = Record<string, Partial<Record<HfmCandleTf, HfmCandleBar[]>>>;

export type HfmSseStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "auth_required"
  | "error";

export interface HfmRealtimeState {
  sseStatus: HfmSseStatus;
  freshness: HfmFreshness;
  connectionState: HfmConnectionState;
  lastSeq: number | null;
  lastEventAt: number | null;
  lastHeartbeatAt: number | null;
  lastError: string | null;
  terminalRunning: boolean | null;
  terminalConnected: boolean | null;
  authenticated: boolean | null;
  ageSec: number | null;
  account: HfmAccountState | null;
  quotes: Record<string, HfmQuoteState>;
  candles: HfmCandleMap;
  placesOrders: boolean;
  acceptsForExecution: boolean;
  mutatesBroker: boolean;
  subscriberId: string | null;
}

export const HFM_DASHBOARD_PATH = "/forex/automated-trading/hfm/dashboard";

export function emptyHfmRealtimeState(): HfmRealtimeState {
  return {
    sseStatus: "idle",
    freshness: "WAITING_FOR_DATA",
    connectionState: "waiting",
    lastSeq: null,
    lastEventAt: null,
    lastHeartbeatAt: null,
    lastError: null,
    terminalRunning: null,
    terminalConnected: null,
    authenticated: null,
    ageSec: null,
    account: null,
    quotes: {},
    candles: {},
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    subscriberId: null,
  };
}
