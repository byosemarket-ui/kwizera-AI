/**
 * Provider-neutral market-data contracts (Phases 25–31).
 * Binance and FXCM both register through this layer.
 */

export const MARKET_PROVIDERS = ["BINANCE", "FXCM", "FOREXCONNECT"] as const;
export type MarketProviderId = (typeof MARKET_PROVIDERS)[number];

export const MARKET_ASSET_TYPES = [
  "CRYPTO",
  "FOREX",
  "CFD",
  "COMMODITY",
  "INDEX",
  "TREASURY",
  "SHARE",
  "OTHER",
  "UNKNOWN",
  "STOCK",
] as const;
export type MarketAssetType = (typeof MARKET_ASSET_TYPES)[number];

export const MARKET_DATA_QUALITY_STATES = [
  "LIVE",
  "FRESH",
  "STALE",
  "DISCONNECTED",
  "NO_DATA",
  "INVALID",
  "PARTIAL",
  "GAP",
  "RECONNECTING",
  "ERROR",
  "VALID",
] as const;
export type MarketDataQualityState = (typeof MARKET_DATA_QUALITY_STATES)[number];

export const PROVIDER_HEALTH_STATES = [
  "DISABLED",
  "NOT_CONFIGURED",
  "CONFIGURED",
  "CONNECTING",
  "CONNECTED",
  "AUTHENTICATION_ERROR",
  "NETWORK_ERROR",
  "UNAVAILABLE",
  "ERROR",
] as const;
export type ProviderHealthState = (typeof PROVIDER_HEALTH_STATES)[number];

export interface MarketDataCapabilities {
  instruments: boolean;
  liveQuotes: boolean;
  streamingQuotes: boolean;
  historicalPrices: boolean;
  candles: boolean;
  /** Phase 30/31 — historical + live forming candle sync. */
  liveCandles: boolean;
  trading: boolean;
}

export interface MarketInstrument {
  provider: MarketProviderId;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  marketType: MarketAssetType;
  baseAsset: string | null;
  quoteAsset: string | null;
  status: "available" | "hidden" | "unknown";
  capabilities: MarketDataCapabilities;
  metadata: Record<string, string | number | boolean | null>;
}

/** Provider-neutral quote contract — Phase 25 defines shape only; FXCM does not emit live quotes yet. */
export interface NormalizedMarketQuote {
  provider: MarketProviderId;
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  providerTimestamp: string | null;
  normalizedTimestamp: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  last: number | null;
  source: string;
  dataQuality: MarketDataQualityState;
}

export interface MarketProviderInfo {
  provider: MarketProviderId;
  displayName: string;
  apiPath: string;
  marketTypes: MarketAssetType[];
  environmentLabel: string;
  capabilities: MarketDataCapabilities;
}

export interface MarketProviderHealth {
  provider: MarketProviderId;
  enabled: boolean;
  environment: "demo" | "real" | "public" | "n/a";
  environmentLabel: string;
  configured: boolean;
  authenticated: boolean;
  reachable: boolean;
  status: ProviderHealthState;
  connectionState: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "ERROR";
  liveStreamEnabled: boolean;
  tradingEnabled: boolean;
  instrumentDiscovery: "READY" | "NOT_CONFIGURED" | "ERROR" | "DISABLED";
  checkedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  notes: string[];
}

export interface MarketDataProvider {
  getProviderInfo(): MarketProviderInfo;
  getCapabilities(): MarketDataCapabilities;
  healthCheck(): Promise<MarketProviderHealth>;
  listInstruments(options?: { refresh?: boolean }): Promise<MarketInstrument[]>;
  getInstrument(symbol: string): Promise<MarketInstrument | null>;
}

/** Explicit capability defaults — trading always false. */
export const CAPABILITY_TRADING_DISABLED = false as const;
