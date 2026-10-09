/**
 * Provider-aware market identity — Phase 31.
 * Never identify a market by symbol alone.
 */
import type { MarketAssetType, MarketProviderId } from "./types.js";

export interface MarketIdentity {
  provider: MarketProviderId;
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  /** Provider environment when meaningful (FXCM DEMO/REAL). */
  environment?: string | null;
}

export function parseMarketProviderId(raw: unknown): MarketProviderId | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "BINANCE" || value === "FXCM" || value === "FOREXCONNECT") return value;
  return null;
}

export function normalizeCanonicalSymbol(symbol: string): string {
  return String(symbol ?? "").replace(/[/_-\s]/g, "").trim().toUpperCase();
}

/** Stable identity key: provider + marketType + canonicalSymbol (+ environment). */
export function marketIdentityKey(identity: {
  provider: MarketProviderId;
  marketType: string;
  canonicalSymbol?: string;
  symbol?: string;
  environment?: string | null;
}): string {
  const symbol = normalizeCanonicalSymbol(identity.canonicalSymbol ?? identity.symbol ?? "");
  const env = identity.environment ? `:${String(identity.environment).toUpperCase()}` : "";
  return `${identity.provider}:${String(identity.marketType).toUpperCase()}:${symbol}${env}`;
}

/** Candle identity includes timeframe + open timestamp (UTC seconds). */
export function candleIdentityKey(input: {
  provider: MarketProviderId;
  marketType: string;
  symbol: string;
  timeframe: string;
  time: number;
  environment?: string | null;
}): string {
  const base = marketIdentityKey({
    provider: input.provider,
    marketType: input.marketType,
    symbol: input.symbol,
    environment: input.environment,
  });
  return `${base}:${String(input.timeframe).toLowerCase()}:${Math.floor(input.time)}`;
}

/** Cache key isolation — never EURUSD:15m alone. */
export function marketDataCacheKey(input: {
  provider: MarketProviderId;
  marketType: string;
  symbol: string;
  timeframe?: string;
  kind: "instruments" | "historical" | "quote" | "live-candles" | "snapshot";
  environment?: string | null;
}): string {
  const base = marketIdentityKey({
    provider: input.provider,
    marketType: input.marketType,
    symbol: input.symbol,
    environment: input.environment,
  });
  const tf = input.timeframe ? `:${String(input.timeframe).toLowerCase()}` : "";
  return `${input.kind}:${base}${tf}`;
}

export function buildMarketIdentity(input: {
  provider: MarketProviderId;
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol?: string;
  displaySymbol?: string;
  environment?: string | null;
}): MarketIdentity {
  const providerSymbol = String(input.providerSymbol).trim();
  const canonicalSymbol = normalizeCanonicalSymbol(input.canonicalSymbol ?? providerSymbol);
  const displaySymbol = String(input.displaySymbol ?? providerSymbol).trim() || providerSymbol;
  return {
    provider: input.provider,
    marketType: input.marketType,
    providerSymbol,
    canonicalSymbol,
    displaySymbol,
    environment: input.environment ?? null,
  };
}
