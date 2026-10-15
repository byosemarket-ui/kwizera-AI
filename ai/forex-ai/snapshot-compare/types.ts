/**
 * Phase 43F — Independent Local AI + OpenAI comparison against one snapshot.
 */
import type { LocalAiDecision, LocalSnapshotAnalysisResult } from "../snapshot-local/types.js";
import type { OpenAiSnapshotAnalysisResult } from "../snapshot-openai/types.js";
import type { SnapshotPlanComparison } from "../snapshot-plans/types.js";

export const SNAPSHOT_COMPARE_SCHEMA = "forex-snapshot-ai-compare-v1";

export type AiProviderMode = "LOCAL" | "OPENAI" | "COMPARE";

export type CompareOverallStatus =
  | "both_ok"
  | "partial_local_ok"
  | "partial_openai_ok"
  | "both_failed";

export interface SnapshotCompareRequest {
  snapshotId: string;
  contentFingerprint?: string;
  provider?: string;
  symbol?: string;
  candleTimeframe?: string;
  analysisPeriod?: string;
  localTimeoutMs?: number;
  openaiTimeoutMs?: number;
  /** Phase 46 — same allocation applied independently to both providers. */
  tradeAllocation?: { amount: number; currency: string } | null;
}

export interface ProviderOutcomeSuccess<T> {
  ok: true;
  code: "OK";
  error: null;
  latencyMs: number;
  analysis: T;
}

export interface ProviderOutcomeFailure {
  ok: false;
  code: string;
  error: string;
  latencyMs: number;
  analysis: null;
}

export type LocalProviderOutcome =
  | ProviderOutcomeSuccess<LocalSnapshotAnalysisResult>
  | ProviderOutcomeFailure;

export type OpenAiProviderOutcome =
  | ProviderOutcomeSuccess<OpenAiSnapshotAnalysisResult>
  | ProviderOutcomeFailure;

export interface DeterministicComparison {
  decisionsAgree: boolean;
  localDecision: LocalAiDecision | null;
  openaiDecision: LocalAiDecision | null;
  biasAgree: boolean;
  localBias: string | null;
  openaiBias: string | null;
  sharedEvidence: string[];
  localOnlyEvidence: string[];
  openaiOnlyEvidence: string[];
  confidenceComparable: boolean;
  localConfidence: string | null;
  openaiConfidence: string | null;
  warnings: string[];
  limitations: string[];
  localFailed: boolean;
  openaiFailed: boolean;
  note: string;
  /** Phase 44 — plan-level comparison (AGREEMENT / CONFLICT / …). */
  planComparison: SnapshotPlanComparison | null;
  comparisonComplete: boolean;
}

export interface SnapshotCompareResult {
  schemaVersion: typeof SNAPSHOT_COMPARE_SCHEMA;
  mode: "COMPARE";
  snapshotId: string;
  contentFingerprint: string;
  status: CompareOverallStatus;
  createdAt: string;
  localResult: LocalProviderOutcome;
  openaiResult: OpenAiProviderOutcome;
  comparison: DeterministicComparison;
  latencyMs: number;
}

export interface SnapshotCompareApiResult {
  ok: boolean;
  code: string;
  error: string | null;
  latencyMs: number;
  compare: SnapshotCompareResult | null;
}
