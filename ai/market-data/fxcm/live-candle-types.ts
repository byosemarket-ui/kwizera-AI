/**
 * Phase 30 — FXCM live candle + historical/realtime sync contracts.
 * Price basis matches Phase 28: mid = (bid + ask) / 2.
 */
import type { MarketAssetType } from "../providers/types.js";
import type { FxcmEnvironment } from "./config.js";
import type { FxcmSupportedProjectTimeframe } from "./timeframes.js";
import type { FxcmStreamState } from "./stream-types.js";

export type FxcmLiveCandleMode = "HISTORICAL" | "HISTORICAL_PLUS_LIVE" | "LIVE";

export type FxcmLiveCandleQualityStatus =
  | "VALID"
  | "PARTIAL"
  | "GAP"
  | "STALE"
  | "INVALID"
  | "NO_DATA";

/** Canonical FXCM candle used by live sync (epoch seconds UTC). */
export interface FxcmLiveCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: null;
  tickQty: number | null;
  closed: boolean;
  priceBasis: "mid";
  provider: "FXCM";
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  timeframe: FxcmSupportedProjectTimeframe;
}

export interface FxcmCandleIdentity {
  provider: "FXCM";
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  timeframe: FxcmSupportedProjectTimeframe;
  /** Candle open timestamp (epoch seconds UTC). */
  time: number;
}

export interface SafeFxcmLiveCandleSeries {
  provider: "FXCM";
  environment: FxcmEnvironment;
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  marketType: MarketAssetType;
  symbol: string;
  canonicalSymbol: string;
  providerSymbol: string;
  displaySymbol: string;
  timeframe: FxcmSupportedProjectTimeframe;
  mode: FxcmLiveCandleMode;
  streamState: FxcmStreamState;
  live: boolean;
  priceBasis: "mid";
  trading: "DISABLED";
  count: number;
  candles: FxcmLiveCandle[];
  forming: FxcmLiveCandle | null;
  lastQuoteAt: string | null;
  lastSourceTimestamp: string | null;
  quality: {
    status: FxcmLiveCandleQualityStatus;
    candleCount: number;
    formingOpen: boolean;
    duplicatesRemoved: number;
    invalidQuotes: number;
    reconciledGaps: number;
    source: "FXCM";
  };
  note: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export function fxcmLiveCandleSeriesKey(
  providerSymbol: string,
  timeframe: FxcmSupportedProjectTimeframe,
  marketType: MarketAssetType = "FOREX",
): string {
  return `FXCM:${marketType}:${providerSymbol}:${timeframe}`;
}
