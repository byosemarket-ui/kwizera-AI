/**
 * Normalize OpenAI JSON into the shared snapshot-analysis contract.
 */
import {
  normalizeLocalAnalysisFromModel,
  buildNoTradeResult,
  parseLocalAiDecision,
} from "../snapshot-local/validate-result.js";
import type {
  LocalSnapshotAnalysisResult,
  LocalSnapshotEvidencePackage,
} from "../snapshot-local/types.js";
import {
  OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
  type OpenAiNewsResearchStatus,
  type OpenAiSnapshotAnalysisResult,
} from "./types.js";

export { parseLocalAiDecision };

export function toOpenAiAnalysisResult(input: {
  localLike: LocalSnapshotAnalysisResult;
  newsResearchStatus: OpenAiNewsResearchStatus;
}): OpenAiSnapshotAnalysisResult {
  const a = input.localLike;
  return {
    analysisId: a.analysisId,
    schemaVersion: OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
    analysisProvider: "OPENAI",
    snapshotId: a.snapshotId,
    contentFingerprint: a.contentFingerprint,
    provider: a.provider,
    instrument: a.instrument,
    candleTimeframe: a.candleTimeframe,
    analysisPeriod: a.analysisPeriod,
    model: a.model,
    createdAt: a.createdAt,
    status: a.status,
    dataQuality: a.dataQuality,
    marketBias: a.marketBias,
    marketStructureSummary: a.marketStructureSummary,
    keyEvidence: a.keyEvidence,
    bullishScenario: a.bullishScenario,
    bearishScenario: a.bearishScenario,
    decision: a.decision,
    decisionRationale: a.decisionRationale,
    invalidationConditions: a.invalidationConditions,
    confidence: a.confidence,
    limitations: [
      ...a.limitations,
      "Provider: OpenAI (independent of Local AI).",
    ],
    evidenceCategories: a.evidenceCategories,
    warnings: a.warnings,
    inferenceLatencyMs: a.inferenceLatencyMs,
    newsResearchStatus: input.newsResearchStatus,
    newsSources: [],
    error: a.error,
  };
}

export function normalizeOpenAiAnalysisFromModel(input: {
  raw: Record<string, unknown>;
  evidence: LocalSnapshotEvidencePackage;
  analysisId: string;
  model: string | null;
  inferenceLatencyMs: number | null;
  newsResearchStatus: OpenAiNewsResearchStatus;
}): { ok: true; analysis: OpenAiSnapshotAnalysisResult } | { ok: false; code: string; error: string } {
  const normalized = normalizeLocalAnalysisFromModel({
    raw: input.raw,
    evidence: input.evidence,
    analysisId: input.analysisId,
    model: input.model,
    inferenceLatencyMs: input.inferenceLatencyMs,
  });
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    analysis: toOpenAiAnalysisResult({
      localLike: normalized.analysis,
      newsResearchStatus: input.newsResearchStatus,
    }),
  };
}

export function buildOpenAiNoTradeResult(input: {
  analysisId: string;
  evidence: LocalSnapshotEvidencePackage;
  model: string | null;
  reason: string;
  inferenceLatencyMs?: number | null;
  newsResearchStatus?: OpenAiNewsResearchStatus;
  status?: OpenAiSnapshotAnalysisResult["status"];
  error?: string | null;
}): OpenAiSnapshotAnalysisResult {
  const base = buildNoTradeResult({
    analysisId: input.analysisId,
    evidence: input.evidence,
    model: input.model,
    reason: input.reason,
    inferenceLatencyMs: input.inferenceLatencyMs,
  });
  return {
    ...toOpenAiAnalysisResult({
      localLike: base,
      newsResearchStatus: input.newsResearchStatus ?? "unavailable",
    }),
    status: input.status ?? "completed",
    error: input.error ?? null,
    limitations: [
      ...base.limitations,
      "Provider: OpenAI (independent of Local AI).",
      "External news research unavailable in Phase 43E.",
    ],
  };
}
