/**
 * Unified Market Data contracts — Phase 31.
 * Provider adapters normalize into these shapes before consumers see them.
 */
import type { MarketIdentity } from "./identity.js";
import type {
  MarketAssetType,
  MarketDataQualityState,
  MarketProviderId,
  NormalizedMarketQuote,
} from "./types.js";

export const CANONICAL_TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
] as const;

export type CanonicalTimeframeId = (typeof CANONICAL_TIMEFRAMES)[number];

export const UNIFIED_CONNECTION_STATES = [
  "DISABLED",
  "NOT_CONFIGURED",
  "CONNECTING",
  "CONNECTED",
  "LIVE",
  "RECONNECTING",
  "STALE",
  "DISCONNECTED",
  "ERROR",
  "AUTHENTICATION_ERROR",
  "NO_DATA",
] as const;

export type UnifiedConnectionState = (typeof UNIFIED_CONNECTION_STATES)[number];

export const UNIFIED_DATA_QUALITY_STATES = [
  "VALID",
  "PARTIAL",
  "STALE",
  "DISCONNECTED",
  "NO_DATA",
  "INVALID",
  "GAP",
  "RECONNECTING",
  "ERROR",
  "LIVE",
  "FRESH",
] as const;

export type UnifiedDataQualityState = (typeof UNIFIED_DATA_QUALITY_STATES)[number];

export type MarketDataSourceMode = "HISTORICAL" | "LIVE" | "HISTORICAL_LIVE";

export interface UnifiedCandle {
  provider: MarketProviderId;
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  timeframe: CanonicalTimeframeId;
  /** Candle open time — Unix seconds UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  isClosed: boolean;
  source: MarketProviderId;
  sourceMode: MarketDataSourceMode;
  dataQuality: UnifiedDataQualityState;
}

export interface UnifiedCandleSeries {
  identity: MarketIdentity;
  timeframe: CanonicalTimeframeId;
  source: MarketProviderId;
  sourceMode: MarketDataSourceMode;
  connectionState: UnifiedConnectionState;
  dataQuality: UnifiedDataQualityState;
  candles: UnifiedCandle[];
  forming: UnifiedCandle | null;
  count: number;
  lastQuoteAt: string | null;
  updatedAt: string;
  note: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface UnifiedQuote extends NormalizedMarketQuote {
  displaySymbol: string;
  receivedAt?: string | null;
  sourceMode: "LIVE" | "SNAPSHOT";
  connectionState: UnifiedConnectionState;
}

export interface UnifiedMarketSnapshot {
  identity: MarketIdentity;
  quote: UnifiedQuote | null;
  candle: UnifiedCandle | null;
  series: UnifiedCandleSeries | null;
  connectionState: UnifiedConnectionState;
  dataQuality: UnifiedDataQualityState;
  updatedAt: string;
}

export interface UnifiedProviderHealth {
  provider: MarketProviderId;
  authentication: string;
  connection: UnifiedConnectionState;
  data: UnifiedConnectionState | "READY" | "STREAMING" | "DISABLED";
  lastEventAt: string | null;
  lastDataAt: string | null;
  latencyMs: number | null;
  capabilities: {
    instrumentDiscovery: boolean;
    historical: boolean;
    quotes: boolean;
    streaming: boolean;
    candles: boolean;
    liveCandles: boolean;
    trading: boolean;
  };
  environment: string;
  notes: string[];
  diagnostics?: Record<string, string | number | boolean | null>;
}

export function isCanonicalTimeframe(raw: string): raw is CanonicalTimeframeId {
  return (CANONICAL_TIMEFRAMES as readonly string[]).includes(raw.toLowerCase());
}

export function parseCanonicalTimeframe(raw: unknown): CanonicalTimeframeId | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return isCanonicalTimeframe(value) ? value : null;
}

/** Map common provider/UI connection labels into the unified model. */
export function normalizeConnectionState(raw: unknown): UnifiedConnectionState {
  const value = String(raw ?? "").trim().toUpperCase();
  if ((UNIFIED_CONNECTION_STATES as readonly string[]).includes(value)) {
    return value as UnifiedConnectionState;
  }
  if (value === "AUTHENTICATED" || value === "READY") return "CONNECTED";
  if (value === "NETWORK_ERROR" || value === "UNAVAILABLE") return "ERROR";
  return "DISCONNECTED";
}

export function normalizeDataQuality(raw: unknown): UnifiedDataQualityState {
  const value = String(raw ?? "").trim().toUpperCase();
  if ((UNIFIED_DATA_QUALITY_STATES as readonly string[]).includes(value)) {
    return value as UnifiedDataQualityState;
  }
  if (value === "FRESH") return "VALID";
  return "NO_DATA";
}
