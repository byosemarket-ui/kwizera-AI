/**
 * STEP 2A — HFM MT5 canonical quote contract (Demo read-only).
 * Static catalog metadata stays separate from dynamic quotes.
 * STEP 1B / B1 adds explicit UTC timestamp normalization fields (additive).
 */

import type {
  HfmTimestampNormalizationStatus,
  HfmTimestampSource,
} from "./quote-timestamp.js";
import type { HfmMarketSessionState } from "./market-session.js";
import type {
  HfmDataQualityStatus,
  HfmQuoteFreshnessStatus,
} from "./quote-freshness.js";

export const HFM_QUOTE_PROVIDER = "HFM_MT5" as const;
export const HFM_QUOTE_ENVIRONMENT = "demo" as const;

export type {
  HfmTimestampNormalizationStatus,
  HfmTimestampSource,
} from "./quote-timestamp.js";

export type { HfmMarketSessionState } from "./market-session.js";

export const HFM_QUOTE_STATUSES = [
  "LIVE",
  "STALE",
  "MARKET_CLOSED",
  "NO_QUOTE",
  "INVALID",
  "INCOMPLETE",
  "DELAYED",
  "ERROR",
  "WAITING_FOR_DATA",
] as const;
export type HfmQuoteStatus = (typeof HFM_QUOTE_STATUSES)[number];

export type HfmQuoteValidationVerdict = "ok" | "rejected" | "partial" | "warning";

export interface HfmQuoteValidationResult {
  verdict: HfmQuoteValidationVerdict;
  errors: string[];
  warnings: string[];
  catalogMatched: boolean;
  catalogVersion: string | null;
}

export interface HfmCanonicalQuote {
  provider: typeof HFM_QUOTE_PROVIDER;
  environment: typeof HFM_QUOTE_ENVIRONMENT;
  server: string | null;
  symbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  /** Price units: ask - bid when both valid. */
  spread: number | null;
  /** (ask - bid) / point when point > 0. */
  spreadPoints: number | null;
  /** Broker SYMBOL_SPREAD (points) when provided — distinct from calculated spread. */
  brokerSpreadPoints: number | null;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
  tickVolume: number | null;
  realVolume: number | null;
  tickFlags: number | null;
  /**
   * Broker-domain tick time (unix-like seconds on the broker server clock).
   * Not UTC. Preserved for compatibility and provenance.
   */
  quoteTimestamp: number | null;
  /** Broker-domain tick time milliseconds when available. Not UTC. */
  quoteTimestampMs: number | null;
  /**
   * UTC-normalized tick time in unix seconds when brokerUtcOffsetSec is trusted.
   * Null when normalization is unavailable or unreliable — never fabricated.
   */
  quoteTimestampUtc: number | null;
  /** UTC-normalized tick time in milliseconds when available. */
  quoteTimestampUtcMs: number | null;
  /**
   * Derived offset seconds: MT5 TimeCurrent() - TimeGMT().
   * Positive means broker clock is ahead of GMT (e.g. +7200 for UTC+2).
   */
  brokerUtcOffsetSec: number | null;
  /**
   * Core/agent UTC receipt instant (ISO-8601). Same value as receivedAt;
   * explicit alias for timestamp contract clarity.
   */
  receivedAtUtc: string;
  /**
   * Backward-compatible B1 field.
   * Formula: quoteTimestamp(brokerSec) − receivedAtUtcSec
   * ≈ brokerUtcOffsetSec − tickAgeSec when UTC normalization is trusted.
   * Not pure oscillator skew (Core vs TimeGMT); keep distinct from brokerUtcOffsetSec.
   */
  clockSkewSec: number | null;
  timestampSource: HfmTimestampSource;
  timestampNormalizationStatus: HfmTimestampNormalizationStatus;
  timestampNormalizationReason: string | null;
  /** B1.1 — schedule/connectivity classification (distinct from quote freshness). */
  marketSessionState: HfmMarketSessionState;
  marketSessionReason: string | null;
  /** True when TimeCurrent appears frozen vs TimeGMT. */
  brokerClockFrozen: boolean;
  /**
   * STEP 1B.2 — distinct ages (seconds). tickAgeSec is null when UTC normalization
   * is untrusted; never derived from raw broker quoteTimestamp.
   */
  snapshotAgeSec: number | null;
  tickAgeSec: number | null;
  receiptAgeSec: number | null;
  quoteFreshnessStatus: HfmQuoteFreshnessStatus | null;
  dataQualityStatus: HfmDataQualityStatus | null;
  freshnessReason: string | null;
  /** Core/agent UTC receipt instant (ISO-8601). */
  receivedAt: string;
  sequence: number | null;
  status: HfmQuoteStatus;
  validation: HfmQuoteValidationResult;
  source: "HFM_MT5" | "mql5_readonly_snapshot";
  acquisitionMethod: "SymbolInfoTick" | "SymbolInfoDouble" | "unknown";
  previousStatus: HfmQuoteStatus | null;
  statusReason: string | null;
  statusChangedAt: string | null;
  mutatesBroker: false;
  placesOrders: false;
  acceptsForExecution: false;
}

export interface HfmQuoteServiceSnapshot {
  provider: typeof HFM_QUOTE_PROVIDER;
  environment: typeof HFM_QUOTE_ENVIRONMENT;
  server: string | null;
  receivedAt: string;
  sequence: number | null;
  feedFreshness: string;
  marketClosed: boolean;
  terminalRunning: boolean | null;
  subscribedSymbols: string[];
  quotes: HfmCanonicalQuote[];
  counts: {
    live: number;
    stale: number;
    marketClosed: number;
    noQuote: number;
    invalid: number;
    incomplete: number;
    delayed: number;
    error: number;
    waiting: number;
  };
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

/** Default quote universe — preserves existing nine-symbol engine. */
export const HFM_DEFAULT_QUOTE_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
  "XAUUSD",
  "XAGUSD",
] as const;
