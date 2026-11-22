/**
 * P8.E F1 — evaluate-time analytical confidence resolution + normalization.
 * Non-probability analytical score. Never rewrites reasoning store records.
 */
import { normalizeHfmReasoningConfidence } from "../reasoning/confidence.js";
import { HfmReasoningStorage } from "../reasoning/storage.js";
import type { HfmReasoningRecord } from "../reasoning/types.js";
import { HFM_CHARTS_CONFIDENCE_BUCKETS } from "./contracts.js";

export const HFM_CHARTS_CONFIDENCE_SEMANTICS =
  "NON_PROBABILITY_ANALYTICAL_SCORE" as const;

export type HfmChartsConfidenceScale =
  | "zero"
  | "fraction"
  | "percent"
  | "invalid"
  | null;

export type HfmChartsConfidenceSource =
  | "REASONING_STORE"
  | "UNAVAILABLE"
  | "TEST_OVERRIDE";

export type HfmChartsConfidenceUnavailableReason =
  | "MISSING_ANALYSIS_RUN_ID"
  | "REASONING_RECORD_NOT_FOUND"
  | "REASONING_ANALYSIS_ID_MISMATCH"
  | "CONFIDENCE_MISSING"
  | "CONFIDENCE_INVALID"
  | "TEST_OVERRIDE_INVALID"
  | null;

export interface HfmChartsConfidenceProvenanceFields {
  analyticalConfidence: number | null;
  rawAnalyticalConfidence: number | string | null;
  confidenceScale: HfmChartsConfidenceScale;
  confidenceSource: HfmChartsConfidenceSource;
  confidenceAnalysisId: string | null;
  confidenceNormalizedAt: string | null;
  confidenceSemantics: typeof HFM_CHARTS_CONFIDENCE_SEMANTICS;
  confidenceUnavailableReason: HfmChartsConfidenceUnavailableReason;
}

export function unavailableConfidenceProvenance(
  reason: Exclude<HfmChartsConfidenceUnavailableReason, null>,
  extras?: {
    confidenceAnalysisId?: string | null;
    rawAnalyticalConfidence?: number | string | null;
    confidenceScale?: HfmChartsConfidenceScale;
    confidenceNormalizedAt?: string | null;
  },
): HfmChartsConfidenceProvenanceFields {
  return {
    analyticalConfidence: null,
    rawAnalyticalConfidence: extras?.rawAnalyticalConfidence ?? null,
    confidenceScale: extras?.confidenceScale ?? "invalid",
    confidenceSource: "UNAVAILABLE",
    confidenceAnalysisId: extras?.confidenceAnalysisId ?? null,
    confidenceNormalizedAt: extras?.confidenceNormalizedAt ?? null,
    confidenceSemantics: HFM_CHARTS_CONFIDENCE_SEMANTICS,
    confidenceUnavailableReason: reason,
  };
}

/**
 * Canonical 0–100 normalization for calibration provenance.
 * Reuses existing reasoning normalizer:
 * - 0 → 0 (zero)
 * - (0, 1] → round(n*100) (fraction); note: value 1 → 100 by existing contract
 * - (1, 100] → round(n) (percent)
 */
export function normalizeChartsAnalyticalConfidence(raw: unknown): {
  ok: true;
  confidence: number;
  scale: "zero" | "fraction" | "percent";
  raw: number | string;
} | {
  ok: false;
  reason: "CONFIDENCE_MISSING" | "CONFIDENCE_INVALID";
  scale: "invalid";
  raw: number | string | null;
} {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "CONFIDENCE_MISSING", scale: "invalid", raw: null };
  }
  const preserved: number | string =
    typeof raw === "number" || typeof raw === "string" ? raw : String(raw);
  const normalized = normalizeHfmReasoningConfidence(raw);
  if (!normalized.ok) {
    return {
      ok: false,
      reason: normalized.error.includes("missing") || normalized.error.includes("empty")
        ? "CONFIDENCE_MISSING"
        : "CONFIDENCE_INVALID",
      scale: "invalid",
      raw: preserved,
    };
  }
  return {
    ok: true,
    confidence: normalized.confidence,
    scale: normalized.scale,
    raw: preserved,
  };
}

/**
 * Stable equality material for confidence provenance (excludes operational timestamps).
 */
export function stableConfidenceProvenanceEquality(
  p: Pick<
    HfmChartsConfidenceProvenanceFields,
    | "analyticalConfidence"
    | "rawAnalyticalConfidence"
    | "confidenceScale"
    | "confidenceSource"
    | "confidenceAnalysisId"
    | "confidenceSemantics"
    | "confidenceUnavailableReason"
  >,
): string {
  return JSON.stringify({
    analyticalConfidence: p.analyticalConfidence,
    rawAnalyticalConfidence: p.rawAnalyticalConfidence,
    confidenceScale: p.confidenceScale,
    confidenceSource: p.confidenceSource,
    confidenceAnalysisId: p.confidenceAnalysisId,
    confidenceSemantics: p.confidenceSemantics,
    confidenceUnavailableReason: p.confidenceUnavailableReason,
  });
}

export function legacyConfidenceProvenanceDefaults(
  analyticalConfidence: number | null | undefined,
): HfmChartsConfidenceProvenanceFields {
  // Historical P8.C rows written before F1: readable with soft defaults.
  if (analyticalConfidence == null || !Number.isFinite(analyticalConfidence)) {
    return unavailableConfidenceProvenance("CONFIDENCE_MISSING", {
      confidenceScale: null,
    });
  }
  const n = normalizeChartsAnalyticalConfidence(analyticalConfidence);
  if (!n.ok) {
    return unavailableConfidenceProvenance(n.reason, {
      rawAnalyticalConfidence: n.raw,
      confidenceScale: "invalid",
    });
  }
  return {
    analyticalConfidence: n.confidence,
    rawAnalyticalConfidence: n.raw,
    confidenceScale: n.scale,
    confidenceSource: "UNAVAILABLE",
    confidenceAnalysisId: null,
    confidenceNormalizedAt: null,
    confidenceSemantics: HFM_CHARTS_CONFIDENCE_SEMANTICS,
    confidenceUnavailableReason: "CONFIDENCE_MISSING",
  };
}

export async function resolveChartsConfidenceProvenance(input: {
  analysisRunId: string | null | undefined;
  reasoningStorage?: HfmReasoningStorage;
  /** Test-only path. Production API must never enable this. */
  testOnlyAllowConfidenceOverride?: boolean;
  testOnlyAnalyticalConfidenceOverride?: unknown;
  normalizedAt?: string;
}): Promise<HfmChartsConfidenceProvenanceFields> {
  const normalizedAt = input.normalizedAt ?? new Date().toISOString();

  if (input.testOnlyAllowConfidenceOverride === true) {
    const n = normalizeChartsAnalyticalConfidence(
      input.testOnlyAnalyticalConfidenceOverride,
    );
    if (!n.ok) {
      return unavailableConfidenceProvenance("TEST_OVERRIDE_INVALID", {
        rawAnalyticalConfidence: n.raw,
        confidenceScale: "invalid",
        confidenceNormalizedAt: normalizedAt,
      });
    }
    return {
      analyticalConfidence: n.confidence,
      rawAnalyticalConfidence: n.raw,
      confidenceScale: n.scale,
      confidenceSource: "TEST_OVERRIDE",
      confidenceAnalysisId: null,
      confidenceNormalizedAt: normalizedAt,
      confidenceSemantics: HFM_CHARTS_CONFIDENCE_SEMANTICS,
      confidenceUnavailableReason: null,
    };
  }

  const analysisRunId =
    input.analysisRunId != null ? String(input.analysisRunId).trim() : "";
  if (!analysisRunId) {
    return unavailableConfidenceProvenance("MISSING_ANALYSIS_RUN_ID", {
      confidenceScale: null,
      confidenceNormalizedAt: normalizedAt,
    });
  }

  const storage = input.reasoningStorage ?? new HfmReasoningStorage();
  let record: HfmReasoningRecord | null = null;
  try {
    record = await storage.load(analysisRunId);
  } catch {
    return unavailableConfidenceProvenance("REASONING_RECORD_NOT_FOUND", {
      confidenceAnalysisId: analysisRunId,
      confidenceScale: null,
      confidenceNormalizedAt: normalizedAt,
    });
  }
  if (!record) {
    return unavailableConfidenceProvenance("REASONING_RECORD_NOT_FOUND", {
      confidenceAnalysisId: analysisRunId,
      confidenceScale: null,
      confidenceNormalizedAt: normalizedAt,
    });
  }
  if (String(record.analysisId || "").trim() !== analysisRunId) {
    return unavailableConfidenceProvenance("REASONING_ANALYSIS_ID_MISMATCH", {
      confidenceAnalysisId: analysisRunId,
      confidenceScale: null,
      confidenceNormalizedAt: normalizedAt,
    });
  }

  const raw = record.result?.decision?.confidence;
  const n = normalizeChartsAnalyticalConfidence(raw);
  if (!n.ok) {
    return unavailableConfidenceProvenance(n.reason, {
      confidenceAnalysisId: analysisRunId,
      rawAnalyticalConfidence: n.raw,
      confidenceScale: "invalid",
      confidenceNormalizedAt: normalizedAt,
    });
  }
  return {
    analyticalConfidence: n.confidence,
    rawAnalyticalConfidence: n.raw,
    confidenceScale: n.scale,
    confidenceSource: "REASONING_STORE",
    confidenceAnalysisId: analysisRunId,
    confidenceNormalizedAt: normalizedAt,
    confidenceSemantics: HFM_CHARTS_CONFIDENCE_SEMANTICS,
    confidenceUnavailableReason: null,
  };
}

/** Shared F1/P8.D canonical 0–100 confidence buckets. */
export type HfmChartsCanonicalConfidenceBucket =
  (typeof HFM_CHARTS_CONFIDENCE_BUCKETS)[number];

/** @deprecated Prefer HfmChartsCanonicalConfidenceBucket — alias kept for F1 call sites. */
export type HfmChartsCalibrationCensusBucket = HfmChartsCanonicalConfidenceBucket;

export interface ConfidenceProvenanceLike {
  analyticalConfidence?: number | null;
  rawAnalyticalConfidence?: number | string | null;
  confidenceScale?: HfmChartsConfidenceScale | null;
  confidenceSource?: HfmChartsConfidenceSource | null;
}

/**
 * Derive canonical 0–100 confidence without double-normalizing F1 provenance.
 * - Explicit F1 scale zero|fraction|percent + finite analyticalConfidence → use as-is.
 * - invalid / missing scale with raw → normalize raw via F1 normalizer.
 * - legacy analyticalConfidence only → normalize via F1 normalizer.
 * - Unreliable / missing → null (UNKNOWN).
 */
export function resolveCanonicalConfidence0to100(
  provenance: ConfidenceProvenanceLike | null | undefined,
): number | null {
  if (!provenance) return null;
  const scale = provenance.confidenceScale ?? null;
  const canonical = provenance.analyticalConfidence;

  if (scale === "zero" || scale === "fraction" || scale === "percent") {
    if (canonical == null || !Number.isFinite(canonical)) return null;
    if (canonical < 0 || canonical > 100) return null;
    return canonical;
  }
  if (scale === "invalid") return null;

  const raw =
    provenance.rawAnalyticalConfidence !== undefined
    && provenance.rawAnalyticalConfidence !== null
      ? provenance.rawAnalyticalConfidence
      : canonical;
  if (raw === undefined || raw === null) return null;
  const n = normalizeChartsAnalyticalConfidence(raw);
  return n.ok ? n.confidence : null;
}

/**
 * Shared bucket classifier on canonical 0–100 values.
 * UNKNOWN | [0,50) | [50,75) | [75,100]
 */
export function classifyCanonicalConfidenceBucket(
  canonical0to100: number | null | undefined,
): HfmChartsCanonicalConfidenceBucket {
  if (canonical0to100 == null || !Number.isFinite(canonical0to100)) return "UNKNOWN";
  const c = canonical0to100;
  if (c < 0 || c > 100) return "UNKNOWN";
  if (c < 50) return "<50";
  if (c < 75) return "50–<75";
  return ">=75";
}

/** Classify from evaluation provenance (F1-aware; no double normalize). */
export function classifyConfidenceBucketFromProvenance(
  provenance: ConfidenceProvenanceLike | null | undefined,
): HfmChartsCanonicalConfidenceBucket {
  return classifyCanonicalConfidenceBucket(resolveCanonicalConfidence0to100(provenance));
}

/**
 * Classify a bare confidence number for analytics filters/tests.
 * Uses F1 normalizer (fraction vs percent) then canonical buckets.
 */
export function classifyAnalyticalConfidenceBucket(
  confidence: number | null | undefined,
): HfmChartsCanonicalConfidenceBucket {
  if (confidence == null || !Number.isFinite(confidence)) return "UNKNOWN";
  const n = normalizeChartsAnalyticalConfidence(confidence);
  if (!n.ok) return "UNKNOWN";
  return classifyCanonicalConfidenceBucket(n.confidence);
}

/** F1 census alias — identical to classifyCanonicalConfidenceBucket. */
export function classifyCalibrationCensusBucket(
  canonical0to100: number | null | undefined,
): HfmChartsCalibrationCensusBucket {
  return classifyCanonicalConfidenceBucket(canonical0to100);
}

/** Map legacy P8.D filter tokens to canonical buckets (additive compatibility). */
export function coerceConfidenceBucketFilter(
  raw: string | null | undefined,
): HfmChartsCanonicalConfidenceBucket | null {
  if (raw == null || raw === "") return null;
  const t = String(raw).trim();
  if ((HFM_CHARTS_CONFIDENCE_BUCKETS as readonly string[]).includes(t)) {
    return t as HfmChartsCanonicalConfidenceBucket;
  }
  // Legacy P8.D labels → canonical
  if (t === "<0.5") return "<50";
  if (t === "0.5–0.75" || t === "0.5-0.75") return "50–<75";
  if (t === "≥0.75" || t === ">=0.75") return ">=75";
  // Owner semantic aliases
  if (t === "BELOW_50") return "<50";
  if (t === "FROM_50_TO_BELOW_75") return "50–<75";
  if (t === "AT_LEAST_75") return ">=75";
  return null;
}
