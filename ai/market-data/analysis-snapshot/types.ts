/**
 * Phase 43B/43C — Immutable analysis market-data snapshot contracts.
 * Distinct from UnifiedMarketSnapshot (current-market glance) and ForexMarketMemorySnapshot (journal).
 */
import type { CanonicalTimeframeId } from "../providers/contracts.js";
import type { MarketAssetType, MarketProviderId } from "../providers/types.js";

export const ANALYSIS_SNAPSHOT_SCHEMA_VERSION = "forex-analysis-snapshot-v1";

/** Validated analysis lookback periods (independent of candle timeframe). */
export const ANALYSIS_PERIOD_IDS = [
  "5m",
  "30m",
  "2h",
  "3h",
  "4h",
  "5h",
  "6h",
  "12h",
  "24h",
  "2d",
  "3d",
  "4d",
  "5d",
  "6d",
  "7d",
  "custom",
] as const;

export type AnalysisPeriodId = (typeof ANALYSIS_PERIOD_IDS)[number];

export const ANALYSIS_SNAPSHOT_VALIDATION_STATUSES = [
  "VALID",
  "VALID_WITH_WARNINGS",
  "INSUFFICIENT_DATA",
  "STALE_DATA",
  "MARKET_INACTIVE",
  "PROVIDER_ERROR",
  "INVALID_REQUEST",
] as const;

export type AnalysisSnapshotValidationStatus =
  (typeof ANALYSIS_SNAPSHOT_VALIDATION_STATUSES)[number];

export const ANALYSIS_QUOTE_FRESHNESS_STATES = [
  "LIVE",
  "STALE",
  "MARKET_INACTIVE",
  "WAITING",
  "UNAVAILABLE",
  "HISTORICAL_ONLY",
] as const;

export type AnalysisQuoteFreshnessState =
  (typeof ANALYSIS_QUOTE_FRESHNESS_STATES)[number];

export interface AnalysisSnapshotRequest {
  provider: MarketProviderId | string;
  symbol: string;
  candleTimeframe: CanonicalTimeframeId | string;
  analysisPeriod: AnalysisPeriodId | string;
  /** Required when analysisPeriod is `custom` — server-validated UTC bounds. */
  rangeStartUtc?: string;
  rangeEndUtc?: string;
  /** Optional higher timeframes reserved for later AI modes — validated but not required. */
  higherTimeframes?: string[];
  /** When true, VALID requires a fresh instrument-specific live quote. */
  requireLiveQuote?: boolean;
  marketType?: MarketAssetType | string | null;
  requestId?: string;
}

export interface AnalysisTimeRange {
  startUtc: string;
  endUtc: string;
  startMs: number;
  endMs: number;
}

export interface AnalysisSnapshotCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  isClosed: boolean;
  resampled: boolean;
  /** True when the aggregation window lacked a full set of source candles. */
  incompleteAggregation?: boolean;
}

export interface AnalysisSnapshotQuote {
  provider: MarketProviderId;
  providerSymbol: string;
  canonicalSymbol: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  last: number | null;
  priceBasis: "bid" | "ask" | "last" | "mid" | null;
  /** Broker/provider event time when available; null when SDK does not expose it. */
  providerEventTimestamp: string | null;
  providerEventTimestampAvailable: boolean;
  serverReceiptTimestamp: string | null;
  ageMs: number | null;
  freshness: AnalysisQuoteFreshnessState;
  source: string | null;
  environment: string | null;
}

export type AnalysisGapReason = "DATA_GAP" | "MARKET_CLOSURE" | "UNKNOWN";

export interface AnalysisDataGap {
  startUtc: string;
  endUtc: string;
  missingIntervals: number;
  reason: AnalysisGapReason;
}

export interface AnalysisSnapshotValidation {
  status: AnalysisSnapshotValidationStatus;
  checks: Array<{
    id: string;
    ok: boolean;
    detail: string;
  }>;
  warnings: string[];
  errors: string[];
}

export interface AnalysisMarketSnapshot {
  snapshotId: string;
  schemaVersion: typeof ANALYSIS_SNAPSHOT_SCHEMA_VERSION;
  requestId: string;
  createdAt: string;
  provider: MarketProviderId;
  instrument: {
    providerSymbol: string;
    canonicalSymbol: string;
    displaySymbol: string;
    marketType: MarketAssetType;
  };
  environment: string;
  priceBasis: "bid" | "ask" | "last" | "mid" | "unknown";
  candleTimeframe: CanonicalTimeframeId;
  analysisPeriod: AnalysisPeriodId;
  requestedRange: AnalysisTimeRange;
  returnedRange: AnalysisTimeRange | null;
  candleCount: number;
  candlesRequestedEstimate: number;
  candles: AnalysisSnapshotCandle[];
  latestQuote: AnalysisSnapshotQuote | null;
  marketStatus: string;
  freshness: {
    quote: AnalysisQuoteFreshnessState;
    historicalCoverageRatio: number;
    formingCandlePresent: boolean;
    /** Phase 47 — completed candles in the aligned window (excludes forming). */
    closedCandleCount?: number;
    /** Phase 47 — expected completed opens for the aligned window. */
    expectedClosedCandles?: number;
    /** Phase 47 — forming tip count (0 or 1). */
    formingCandleCount?: number;
    /** Phase 47 — window uses candle-open half-open [start, end). */
    windowBoundaryPolicy?: "candle_aligned_half_open";
  };
  validation: AnalysisSnapshotValidation;
  dataGaps: AnalysisDataGap[];
  sourceMetadata: {
    historicalSourceMode: string | null;
    seriesNote: string | null;
    seriesErrorCode: string | null;
    resampled: boolean;
    sourceTimeframe: CanonicalTimeframeId | null;
  };
  warnings: string[];
  evidenceReady: boolean;
  contentFingerprint: string;
}

export interface CreateAnalysisSnapshotResult {
  ok: boolean;
  snapshot: AnalysisMarketSnapshot | null;
  code: string;
  error: string | null;
  latencyMs: number;
}
