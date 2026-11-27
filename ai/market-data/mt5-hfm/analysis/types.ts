/**
 * Phase 2 — HFM Analysis preparation types (no trading decisions).
 */
import type { HfmAnalysisDefaultTf } from "./constants.js";

export type HfmAnalysisQualityStatus =
  | "VALID"
  | "DEGRADED"
  | "INVALID"
  | "STALE"
  | "INCOMPLETE";

export type HfmAnalysisPrepState =
  | "QUEUED"
  | "COLLECTING_DATA"
  | "NORMALIZING"
  | "VALIDATING"
  | "SYNCHRONIZING"
  | "RENDERING_IMAGES"
  | "VALIDATING_IMAGES"
  | "COMPLETED"
  | "DEGRADED"
  | "FAILED";

export type HfmAnalysisJobStatus =
  | "RUNNING"
  | "COMPLETED"
  | "DEGRADED"
  | "FAILED";

export interface HfmAnalysisQualityIssue {
  code: string;
  message: string;
  symbol?: string;
  timeframe?: string;
  sourceField?: string;
  severity: "error" | "warning";
  timestamp: string;
}

export interface HfmAnalysisNormalizedCandle {
  symbol: string;
  provider: "HFM_MT5";
  timeframe: string;
  /**
   * Broker-domain candle-open seconds (NOT UTC).
   * Kept for backward compatibility with consumers that sort/group in broker domain.
   */
  timestamp: number;
  /** Explicit broker/server candle-open seconds. */
  brokerOpenTime?: number;
  /** Trusted UTC candle-open seconds; null when untrusted/unavailable. */
  openTimeUtc?: number | null;
  brokerUtcOffsetSec?: number | null;
  timestampNormalizationStatus?: string | null;
  timestampNormalizationReason?: string | null;
  timestampSource?: string | null;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  volumeType: "tick" | "real" | "none";
  provenance: "native" | "derived" | "cached" | "live_aggregate";
  isCurrent: boolean;
  /** Broker-domain source open (not UTC). */
  sourceTimestamp: number | null;
  /** When this normalization/processing occurred (ISO) — not candle-open time. */
  normalizedAt: string;
}

export interface HfmAnalysisTfDataset {
  timeframe: HfmAnalysisDefaultTf | string;
  symbol: string;
  historical: HfmAnalysisNormalizedCandle[];
  current: HfmAnalysisNormalizedCandle | null;
  candleCount: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  freshness: string;
  connectionStatus: string;
  validationStatus: "ok" | "partial" | "rejected" | "unavailable";
  sourceProvenance: string;
  errors: string[];
}

export interface HfmAnalysisQuoteContext {
  symbol: string;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  /** Raw broker-domain tick time (not UTC). */
  brokerTimestamp: number | null;
  /** Trusted UTC tick time when normalization succeeded; never raw broker. */
  quoteTimestampUtc?: number | null;
  receiveTimestamp: string | null;
  /** Feed/status label (LIVE/STALE/DELAYED/MARKET_CLOSED/…). */
  freshness: string;
  acquisition: string | null;
  /** B2 additive freshness contract (optional for older fixtures). */
  marketSessionState?: string | null;
  marketSessionReason?: string | null;
  brokerClockFrozen?: boolean | null;
  timestampNormalizationStatus?: string | null;
  snapshotAgeSec?: number | null;
  tickAgeSec?: number | null;
  receiptAgeSec?: number | null;
  quoteFreshnessStatus?: string | null;
  dataQualityStatus?: string | null;
  freshnessReason?: string | null;
  /** STEP 1B.3 — correlates with REST/SSE accepted quote version. */
  quoteVersionId?: string | null;
  quoteProvenance?: string | null;
}

export interface HfmAnalysisImmutableJob {
  jobId: string;
  provider: "HFM_MT5";
  symbolAtStart: string;
  selectedSymbolVersion: number;
  chartTimeframeAtStart: string;
  analysisTimeframes: readonly string[];
  startedAt: string;
  completedAt: string | null;
  status: HfmAnalysisJobStatus;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export interface HfmAnalysisChartImageMeta {
  imageId: string;
  provider: "HFM_MT5";
  symbol: string;
  timeframe: string;
  snapshotId: string;
  snapshotHash: string;
  imageHash: string;
  capturedAt: string;
  candleStart: number | null;
  candleEnd: number | null;
  imageFormat: "png";
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes: number;
  rendererVersion: string;
  validationStatus: "ok" | "rejected";
  validationErrors: string[];
}

export interface HfmAnalysisDataQualityReport {
  status: HfmAnalysisQualityStatus;
  errors: HfmAnalysisQualityIssue[];
  warnings: HfmAnalysisQualityIssue[];
  approvedForAiReasoning: boolean;
  policyNote: string;
}

export interface HfmAnalysisSyncReport {
  status: HfmAnalysisQualityStatus;
  symbol: string;
  timeframesPresent: string[];
  timeframesMissing: string[];
  latestQuoteTimestamp: number | null;
  latestCandleByTf: Record<string, number | null>;
  warnings: HfmAnalysisQualityIssue[];
  errors: HfmAnalysisQualityIssue[];
}

export interface HfmAnalysisMultiTfSnapshot {
  snapshotId: string;
  snapshotHash: string;
  hashVersion: string;
  provider: "HFM_MT5";
  symbol: string;
  capturedAt: string;
  chartTimeframeAtStart: string;
  timeframes: Record<string, HfmAnalysisTfDataset>;
  quote: HfmAnalysisQuoteContext;
  dataQuality: HfmAnalysisDataQualityReport;
  synchronization: HfmAnalysisSyncReport;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export interface HfmAnalysisContextResult {
  ok: boolean;
  state: HfmAnalysisPrepState;
  job: HfmAnalysisImmutableJob;
  snapshot: HfmAnalysisMultiTfSnapshot | null;
  chartImages: Record<string, HfmAnalysisChartImageMeta>;
  /**
   * Phase 3 — optional intelligence orchestration outcome.
   * Opaque JSON-serializable shape; typed at Charts bridge boundary.
   */
  intelligenceOrchestration?: unknown | null;
  timings: {
    collectMs: number;
    normalizeMs: number;
    validateMs: number;
    syncMs: number;
    renderMs: number;
    totalMs: number;
  };
  diagnostics: string[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}
