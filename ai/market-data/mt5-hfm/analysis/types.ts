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
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  volumeType: "tick" | "real" | "none";
  provenance: "native" | "derived" | "cached" | "live_aggregate";
  isCurrent: boolean;
  sourceTimestamp: number | null;
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
  brokerTimestamp: number | null;
  receiveTimestamp: string | null;
  freshness: string;
  acquisition: string | null;
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
