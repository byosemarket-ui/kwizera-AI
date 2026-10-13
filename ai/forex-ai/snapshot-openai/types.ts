/**
 * Phase 43E — Independent OpenAI analysis from an immutable market snapshot.
 * Result semantics align with Phase 43D Local AI (no shared orchestration).
 */
import type {
  LocalAiDecision,
  LocalAiJobStatus,
  LocalSnapshotEvidencePackage,
  SnapshotEvidenceCategories,
} from "../snapshot-local/types.js";
import type { AnalysisPeriodId } from "../../market-data/analysis-snapshot/types.js";
import type { CanonicalTimeframeId } from "../../market-data/providers/contracts.js";
import type { MarketProviderId } from "../../market-data/providers/types.js";

export const OPENAI_SNAPSHOT_ANALYSIS_SCHEMA = "forex-openai-snapshot-analysis-v1";

export type OpenAiNewsResearchStatus =
  | "unavailable"
  | "skipped"
  | "partial"
  | "ok";

export interface OpenAiSnapshotAnalysisRequest {
  snapshotId: string;
  contentFingerprint?: string;
  provider?: string;
  symbol?: string;
  candleTimeframe?: string;
  analysisPeriod?: string;
  timeoutMs?: number;
  /** When true, attempt news research if a safe integration exists (43E: unavailable). */
  includeNewsResearch?: boolean;
}

export interface OpenAiProviderPublicStatus {
  configured: boolean;
  vaultUnlocked: boolean;
  model: string;
  updatedAt: string | null;
  lastValidatedAt: string | null;
  lastValidationStatus: "never" | "ok" | "error" | null;
  note: string;
}

export interface OpenAiSnapshotAnalysisResult {
  analysisId: string;
  schemaVersion: typeof OPENAI_SNAPSHOT_ANALYSIS_SCHEMA;
  analysisProvider: "OPENAI";
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
  newsResearchStatus: OpenAiNewsResearchStatus;
  newsSources: Array<{
    title: string;
    publisher: string | null;
    url: string | null;
    publishedAt: string | null;
    retrievedAt: string | null;
    excerpt: string | null;
  }>;
  error: string | null;
}

export interface OpenAiSnapshotAnalysisApiResult {
  ok: boolean;
  code: string;
  error: string | null;
  latencyMs: number;
  analysis: OpenAiSnapshotAnalysisResult | null;
  evidence: LocalSnapshotEvidencePackage | null;
}

export type { LocalAiDecision, LocalAiJobStatus, LocalSnapshotEvidencePackage, SnapshotEvidenceCategories };
