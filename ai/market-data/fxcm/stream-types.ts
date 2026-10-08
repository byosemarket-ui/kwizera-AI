/**
 * Phase 29 — FXCM real-time quote streaming contracts.
 * Live candle construction is intentionally out of scope (Phase 30).
 */
import type { MarketAssetType, MarketDataQualityState, MarketProviderId } from "../providers/types.js";

export const FXCM_STREAM_STATES = [
  "DISABLED",
  "NOT_CONFIGURED",
  "CONNECTING",
  "CONNECTED",
  "LIVE",
  "RECONNECTING",
  "DISCONNECTED",
  "STALE",
  "ERROR",
  "AUTHENTICATION_ERROR",
  "NETWORK_ERROR",
  "NO_DATA",
] as const;
export type FxcmStreamState = (typeof FXCM_STREAM_STATES)[number];

export const FXCM_SUBSCRIPTION_STATES = [
  "NOT_SUBSCRIBED",
  "SUBSCRIBING",
  "SUBSCRIBED",
  "UNSUBSCRIBING",
  "FAILED",
] as const;
export type FxcmSubscriptionState = (typeof FXCM_SUBSCRIPTION_STATES)[number];

/** Official FXCM market-data push payload (after Socket.IO event unwrap). */
export interface FxcmRawPriceUpdate {
  Updated?: number | string;
  Rates?: number[];
  Symbol?: string;
}

/**
 * Provider-aware normalized quote event for FXCM streaming.
 * Extends the Phase 25 NormalizedMarketQuote shape with stream metadata.
 */
export interface FxcmMarketQuoteEvent {
  provider: MarketProviderId;
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;

  /** Canonical UTC ISO timestamp used for identity/ordering. */
  timestamp: string;
  /** FXCM Updated field (epoch ms). */
  sourceTimestamp: string | null;
  /** Backend receive time (UTC ISO). */
  receivedAt: string;

  bid: number | null;
  ask: number | null;
  mid: number | null;
  last: number | null;
  bidSize: number | null;
  askSize: number | null;
  /** Session high/low when FXCM Rates provides them — informational only. */
  sessionHigh: number | null;
  sessionLow: number | null;

  sequence: number | null;
  latencyMs: number | null;
  connectionState: FxcmStreamState;
  dataQuality: MarketDataQualityState;
  source: "FXCM";
  valid: boolean;
  invalidReason: string | null;
}

export interface FxcmSubscriptionRecord {
  key: string;
  provider: "FXCM";
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  state: FxcmSubscriptionState;
  subscribedAt: string | null;
  lastEventAt: string | null;
  lastSourceTimestamp: string | null;
  eventsReceived: number;
  invalidEvents: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface FxcmStreamMetrics {
  provider: "FXCM";
  environment: "demo" | "real";
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  streamState: FxcmStreamState;
  connectedAt: string | null;
  lastEventAt: string | null;
  lastSourceTimestamp: string | null;
  eventsReceived: number;
  invalidEvents: number;
  reconnectCount: number;
  subscriptionCount: number;
  latencyMs: number | null;
  quoteStaleMs: number;
  notes: string[];
}

export interface SafeFxcmStreamStatus {
  provider: "FXCM";
  environment: "demo" | "real";
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  stream: FxcmStreamMetrics;
  subscriptions: FxcmSubscriptionRecord[];
  quotes: Array<SafeFxcmQuoteSnapshot>;
  authenticationState: string;
  marketData: "STREAMING" | "NOT_STARTED" | "DISABLED";
  liveStream: "ENABLED" | "DISABLED" | "NOT_CONFIGURED";
  trading: "DISABLED";
  mode: "REALTIME_QUOTE";
  note: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SafeFxcmQuoteSnapshot {
  provider: "FXCM";
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  last: number | null;
  sessionHigh: number | null;
  sessionLow: number | null;
  sourceTimestamp: string | null;
  receivedAt: string | null;
  latencyMs: number | null;
  state: FxcmStreamState;
  dataQuality: MarketDataQualityState;
  subscriptionState: FxcmSubscriptionState;
  eventsReceived: number;
}

export function subscriptionKey(
  providerSymbol: string,
  marketType: MarketAssetType = "FOREX",
): string {
  return `FXCM:${marketType}:${providerSymbol}`;
}
