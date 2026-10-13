/**
 * Validate / normalize Local AI JSON against the snapshot evidence contract.
 */
import {
  LOCAL_AI_DECISIONS,
  type LocalAiDecision,
  type LocalSnapshotAnalysisResult,
  type LocalSnapshotEvidencePackage,
  LOCAL_SNAPSHOT_ANALYSIS_SCHEMA,
} from "./types.js";

function asString(v: unknown, max = 600): string {
  const s = String(v ?? "").trim();
  return s.slice(0, max);
}

function asStringList(v: unknown, maxItems = 8, maxLen = 240): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => asString(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function parseLocalAiDecision(raw: unknown): LocalAiDecision | null {
  const v = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if ((LOCAL_AI_DECISIONS as readonly string[]).includes(v)) return v as LocalAiDecision;
  // Soft aliases → WAIT / NO_TRADE only (never invent BUY/SELL from vague text).
  if (v === "HOLD" || v === "NEUTRAL" || v === "OBSERVE") return "WAIT";
  if (v === "NONE" || v === "INVALID" || v === "INSUFFICIENT") return "NO_TRADE";
  return null;
}

export function normalizeLocalAnalysisFromModel(input: {
  raw: Record<string, unknown>;
  evidence: LocalSnapshotEvidencePackage;
  analysisId: string;
  model: string | null;
  inferenceLatencyMs: number | null;
}): { ok: true; analysis: LocalSnapshotAnalysisResult } | { ok: false; code: string; error: string } {
  const decision = parseLocalAiDecision(
    input.raw.decision ?? input.raw.decisionPosture ?? input.raw.action,
  );
  if (!decision) {
    return {
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      error: "Model decision must be BUY, SELL, WAIT, or NO_TRADE.",
    };
  }

  // Prefer WAIT/NO_TRADE when snapshot is not evidence-ready — never upgrade to BUY/SELL.
  let finalDecision = decision;
  if (!input.evidence.evidenceReady && (decision === "BUY" || decision === "SELL")) {
    finalDecision = "NO_TRADE";
  }
  if (
    (input.evidence.quoteFreshness === "STALE" || input.evidence.validationStatus === "STALE_DATA")
    && (decision === "BUY" || decision === "SELL")
  ) {
    finalDecision = "WAIT";
  }

  const confidenceRaw = input.raw.confidence;
  let confidence: string | null = null;
  if (confidenceRaw == null || confidenceRaw === "") {
    confidence = null;
  } else if (typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)) {
    // Do not present numeric scores as calibrated probabilities.
    confidence = `qualitative_score_unverified:${confidenceRaw}`;
  } else {
    confidence = asString(confidenceRaw, 80);
  }

  const limitations = asStringList(input.raw.limitations, 8);
  if (!limitations.some((l) => /not.*execut|analytical|no.?order/i.test(l))) {
    limitations.push("Analytical scenario only — not a broker order instruction.");
  }
  if (confidence?.startsWith("qualitative_score_unverified")) {
    limitations.push("Confidence is not a calibrated probability.");
  }
  if (input.evidence.categories.unavailable.length) {
    limitations.push(
      `Unavailable evidence: ${input.evidence.categories.unavailable.join(", ")}.`,
    );
  }

  const analysis: LocalSnapshotAnalysisResult = {
    analysisId: input.analysisId,
    schemaVersion: LOCAL_SNAPSHOT_ANALYSIS_SCHEMA,
    snapshotId: input.evidence.snapshotId,
    contentFingerprint: input.evidence.contentFingerprint,
    provider: input.evidence.provider,
    instrument: input.evidence.instrument.displaySymbol,
    candleTimeframe: input.evidence.candleTimeframe,
    analysisPeriod: input.evidence.analysisPeriod,
    model: input.model,
    createdAt: new Date().toISOString(),
    status: "completed",
    dataQuality: asString(
      input.raw.dataQuality ?? input.evidence.validationStatus,
      80,
    ) || input.evidence.validationStatus,
    marketBias: asString(input.raw.marketBias ?? input.raw.bias ?? "UNCERTAIN", 120) || "UNCERTAIN",
    marketStructureSummary: asString(
      input.raw.marketStructureSummary ?? input.raw.structureSummary ?? "",
      500,
    ),
    keyEvidence: asStringList(input.raw.keyEvidence ?? input.raw.evidence, 8),
    bullishScenario: asString(input.raw.bullishScenario ?? "", 500),
    bearishScenario: asString(input.raw.bearishScenario ?? "", 500),
    decision: finalDecision,
    decisionRationale: "",
    invalidationConditions: asStringList(
      input.raw.invalidationConditions ?? input.raw.invalidation,
      8,
    ),
    confidence,
    limitations,
    evidenceCategories: input.evidence.categories,
    warnings: [...input.evidence.warnings],
    inferenceLatencyMs: input.inferenceLatencyMs,
    error: null,
  };

  let rationale = asString(
    input.raw.decisionRationale
      ?? input.raw.rationale
      ?? input.raw.reasoning
      ?? input.raw.summary
      ?? input.raw.marketStructureSummary
      ?? "",
    800,
  );
  if (!rationale) {
    const bull = asString(input.raw.bullishScenario, 200);
    const bear = asString(input.raw.bearishScenario, 200);
    if (bull || bear) {
      rationale = `Decision ${finalDecision} from model scenarios (rationale field omitted).`;
    }
  }
  if (!rationale) {
    return {
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      error: "Model response missing decision rationale.",
    };
  }
  analysis.decisionRationale = rationale;

  return { ok: true, analysis };
}

export function buildNoTradeResult(input: {
  analysisId: string;
  evidence: LocalSnapshotEvidencePackage;
  model: string | null;
  reason: string;
  inferenceLatencyMs?: number | null;
}): LocalSnapshotAnalysisResult {
  return {
    analysisId: input.analysisId,
    schemaVersion: LOCAL_SNAPSHOT_ANALYSIS_SCHEMA,
    snapshotId: input.evidence.snapshotId,
    contentFingerprint: input.evidence.contentFingerprint,
    provider: input.evidence.provider,
    instrument: input.evidence.instrument.displaySymbol,
    candleTimeframe: input.evidence.candleTimeframe,
    analysisPeriod: input.evidence.analysisPeriod,
    model: input.model,
    createdAt: new Date().toISOString(),
    status: "completed",
    dataQuality: input.evidence.validationStatus,
    marketBias: "UNCERTAIN",
    marketStructureSummary: "Snapshot unsuitable or inference unavailable for directional analysis.",
    keyEvidence: input.evidence.warnings.slice(0, 4),
    bullishScenario: "Unavailable — insufficient or unsuitable snapshot evidence.",
    bearishScenario: "Unavailable — insufficient or unsuitable snapshot evidence.",
    decision: "NO_TRADE",
    decisionRationale: input.reason,
    invalidationConditions: ["Re-prepare snapshot when market data quality improves."],
    confidence: null,
    limitations: [
      "Analytical scenario only — not a broker order instruction.",
      input.reason,
    ],
    evidenceCategories: input.evidence.categories,
    warnings: input.evidence.warnings,
    inferenceLatencyMs: input.inferenceLatencyMs ?? null,
    error: null,
  };
}
