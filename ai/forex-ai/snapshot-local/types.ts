/**
 * Phase 43D — Local AI analysis from an immutable market-data snapshot.
 */
import type { AnalysisPeriodId } from "../../market-data/analysis-snapshot/types.js";
import type { CanonicalTimeframeId } from "../../market-data/providers/contracts.js";
import type { MarketProviderId } from "../../market-data/providers/types.js";
import type { GuidedAnalysisResponse } from "../analysis-response/types.js";
import type { SnapshotPlanBundle } from "../snapshot-plans/types.js";

export const LOCAL_SNAPSHOT_ANALYSIS_SCHEMA = "forex-local-snapshot-analysis-v1";

export const LOCAL_AI_DECISIONS = ["BUY", "SELL", "WAIT", "NO_TRADE"] as const;
export type LocalAiDecision = (typeof LOCAL_AI_DECISIONS)[number];

export const LOCAL_AI_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
] as const;
export type LocalAiJobStatus = (typeof LOCAL_AI_JOB_STATUSES)[number];

export interface LocalSnapshotAnalysisRequest {
  snapshotId: string;
  /** Optional client-held fingerprint — must match stored snapshot when provided. */
  contentFingerprint?: string;
  /** Optional identity checks — must match snapshot when provided. */
  provider?: string;
  symbol?: string;
  candleTimeframe?: string;
  analysisPeriod?: string;
  timeoutMs?: number;
  /** Phase 46 — allocated trade capital (not acceptable loss). */
  tradeAllocation?: { amount: number; currency: string } | null;
}

export interface SnapshotEvidenceCategories {
  snapshotMeta: boolean;
  candles: boolean;
  quote: boolean;
  validation: boolean;
  patterns: boolean;
  structure: boolean;
  knowledge: boolean;
  unavailable: string[];
}

export interface LocalSnapshotEvidencePackage {
  schemaVersion: "forex-local-snapshot-evidence-v1";
  snapshotId: string;
  contentFingerprint: string;
  provider: MarketProviderId;
  instrument: {
    providerSymbol: string;
    canonicalSymbol: string;
    displaySymbol: string;
  };
  candleTimeframe: CanonicalTimeframeId;
  analysisPeriod: AnalysisPeriodId;
  requestedRange: { startUtc: string; endUtc: string };
  returnedRange: { startUtc: string; endUtc: string } | null;
  priceBasis: string;
  environment: string;
  quoteFreshness: string;
  marketStatus: string;
  candleCount: number;
  candlesRequestedEstimate: number;
  /** Phase 47 — completed vs expected vs forming (from snapshot freshness). */
  closedCandleCount?: number;
  expectedClosedCandles?: number;
  formingCandleCount?: number;
  historicalCoverageRatio?: number;
  windowBoundaryPolicy?: string;
  /** Bounded candle sample for the model (newest last). Completeness metadata is separate. */
  candles: Array<{
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number | null;
    closed: boolean;
  }>;
  /** True when the prompt sample is a subset of closed candles in the snapshot. */
  evidenceCandleSubset?: boolean;
  dataGaps: Array<{ startUtc: string; endUtc: string; missingIntervals: number; reason: string }>;
  warnings: string[];
  validationStatus: string;
  evidenceReady: boolean;
  detectorSummary: string;
  categories: SnapshotEvidenceCategories;
}

export interface LocalSnapshotAnalysisResult {
  analysisId: string;
  schemaVersion: typeof LOCAL_SNAPSHOT_ANALYSIS_SCHEMA;
  snapshotId: string;
  contentFingerprint: string;
  provider: MarketProviderId;
  instrument: string;
  candleTimeframe: CanonicalTimeframeId;
  analysisPeriod: AnalysisPeriodId;
  model: string | null;
  createdAt: string;
  status: LocalAiJobStatus;
  dataQuality: string;
  marketBias: string;
  marketStructureSummary: string;
  keyEvidence: string[];
  bullishScenario: string;
  bearishScenario: string;
  decision: LocalAiDecision;
  decisionRationale: string;
  invalidationConditions: string[];
  confidence: string | null;
  limitations: string[];
  evidenceCategories: SnapshotEvidenceCategories;
  warnings: string[];
  inferenceLatencyMs: number | null;
  error: string | null;
  /** Phase 44 — Pullback/Breakout plans + direction (null if attach failed). */
  planBundle?: SnapshotPlanBundle | null;
  /** Phase 46 — guided sections for UI (deterministic + model provenance). */
  guidedResponse?: GuidedAnalysisResponse | null;
}

export interface LocalSnapshotAnalysisApiResult {
  ok: boolean;
  code: string;
  error: string | null;
  latencyMs: number;
  analysis: LocalSnapshotAnalysisResult | null;
  evidence: LocalSnapshotEvidencePackage | null;
}
