/**
 * Phase 4.18G.1 — Result intake validation (fail-closed).
 */
import { ANALYSIS_CONFIDENCE_TYPE } from "../analysis/canonical-analysis.types.js";
import type { CanonicalAnalysisResult } from "../analysis/canonical-analysis.types.js";
import type {
  AtResultDecision,
  AtResultIntakeEnrichment,
  AtResultValidationStatus,
} from "./types.js";
import { AT_RESULT_INTAKE_DEFAULT_MAX_AGE_MS } from "./types.js";

export function resultIntakeIdempotencyKey(analysisId: string, evidenceFingerprint: string): string {
  return `analysis:${analysisId}|fp:${evidenceFingerprint}`;
}

export function mapCanonicalToDecision(
  result: CanonicalAnalysisResult,
): { decision: AtResultDecision; canonicalDecision: "BUY" | "SELL" | "NO_TRADE" } {
  if (result.finalOutcome === "BUY_CANDIDATE" && result.direction === "BUY") {
    return { decision: "BUY", canonicalDecision: "BUY" };
  }
  if (result.finalOutcome === "SELL_CANDIDATE" && result.direction === "SELL") {
    return { decision: "SELL", canonicalDecision: "SELL" };
  }
  return { decision: "NO_TRADE", canonicalDecision: "NO_TRADE" };
}

export function validateCanonicalForIntake(
  result: CanonicalAnalysisResult | null | undefined,
  enrichment: AtResultIntakeEnrichment | null | undefined,
  opts?: { nowMs?: number; maxAgeMs?: number; requireObservation?: boolean; requireImage?: boolean },
): {
  ok: boolean;
  validationStatus: AtResultValidationStatus;
  rejectionReason: string | null;
} {
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      validationStatus: "INVALID_SCHEMA",
      rejectionReason: "Missing canonical analysis result.",
    };
  }
  if (result.schemaVersion !== "kwizera.canonical-analysis.v1") {
    return {
      ok: false,
      validationStatus: "INVALID_SCHEMA",
      rejectionReason: `Unsupported schemaVersion: ${String(result.schemaVersion)}`,
    };
  }
  if (!result.analysisId || typeof result.analysisId !== "string") {
    return {
      ok: false,
      validationStatus: "MISSING_IDENTITY",
      rejectionReason: "analysisId is required.",
    };
  }
  if (!result.instrument || typeof result.instrument !== "string") {
    return {
      ok: false,
      validationStatus: "MISSING_IDENTITY",
      rejectionReason: "instrument is required.",
    };
  }
  if (!result.analyzedAtUtc || Number.isNaN(Date.parse(result.analyzedAtUtc))) {
    return {
      ok: false,
      validationStatus: "MISSING_IDENTITY",
      rejectionReason: "analyzedAtUtc is required.",
    };
  }

  const allowedOutcomes = new Set([
    "BUY_CANDIDATE",
    "SELL_CANDIDATE",
    "NO_TRADE",
    "CONFLICT",
    "INSUFFICIENT_DATA",
    "STALE_DATA",
  ]);
  if (!allowedOutcomes.has(result.finalOutcome)) {
    return {
      ok: false,
      validationStatus: "RECONCILIATION_FAILURE",
      rejectionReason: `Unknown finalOutcome: ${String(result.finalOutcome)}`,
    };
  }

  if (result.direction != null && result.direction !== "BUY" && result.direction !== "SELL") {
    return {
      ok: false,
      validationStatus: "INVALID_DIRECTION",
      rejectionReason: `Invalid direction: ${String(result.direction)}`,
    };
  }
  if (
    (result.finalOutcome === "BUY_CANDIDATE" && result.direction !== "BUY")
    || (result.finalOutcome === "SELL_CANDIDATE" && result.direction !== "SELL")
  ) {
    return {
      ok: false,
      validationStatus: "INVALID_DIRECTION",
      rejectionReason: "Candidate outcome/direction mismatch.",
    };
  }
  // Phase 2 — non-candidate outcomes may carry BUY/SELL directional bias while
  // trade eligibility remains blocked (NO_TRADE / STALE_DATA / CONFLICT).

  if (result.confidenceType !== ANALYSIS_CONFIDENCE_TYPE) {
    return {
      ok: false,
      validationStatus: "INVALID_CONFIDENCE",
      rejectionReason: "confidenceType must be ANALYSIS_CONFIDENCE.",
    };
  }
  if (
    result.confidenceBreakdown?.isCalibratedWinProbability === true
    || (result as { isCalibratedWinProbability?: unknown }).isCalibratedWinProbability === true
  ) {
    return {
      ok: false,
      validationStatus: "CALIBRATION_CLAIM_REJECTED",
      rejectionReason: "Calibrated win probability claims are rejected.",
    };
  }
  if (
    result.confidencePct != null
    && (!Number.isFinite(result.confidencePct)
      || result.confidencePct < 0
      || result.confidencePct > 100)
  ) {
    return {
      ok: false,
      validationStatus: "INVALID_CONFIDENCE",
      rejectionReason: "directionalConfidencePct must be 0–100 or null.",
    };
  }

  const nowMs = opts?.nowMs ?? Date.now();
  const maxAgeMs = opts?.maxAgeMs ?? AT_RESULT_INTAKE_DEFAULT_MAX_AGE_MS;
  const ageMs = nowMs - Date.parse(result.analyzedAtUtc);
  if (Number.isFinite(ageMs) && ageMs > maxAgeMs) {
    return {
      ok: false,
      validationStatus: "STALE_ANALYSIS",
      rejectionReason: `Analysis age ${Math.floor(ageMs)}ms exceeds max ${maxAgeMs}ms.`,
    };
  }

  const observationId = enrichment?.observationId ?? null;
  const imageId = enrichment?.imageId ?? null;
  const imageHash = enrichment?.imageHash ?? null;
  if (opts?.requireObservation && !observationId) {
    return {
      ok: false,
      validationStatus: "INVALID_OBSERVATION",
      rejectionReason: "observationId is required for this intake path.",
    };
  }
  if (opts?.requireImage && (!imageId || !imageHash)) {
    return {
      ok: false,
      validationStatus: "INVALID_IMAGE",
      rejectionReason: "imageId and imageHash are required for this intake path.",
    };
  }
  if (
    enrichment?.expectedImageHash
    && imageHash
    && enrichment.expectedImageHash !== imageHash
  ) {
    return {
      ok: false,
      validationStatus: "IMAGE_HASH_MISMATCH",
      rejectionReason: "imageHash does not match expected observation binding.",
    };
  }

  if (
    Array.isArray(result.validationErrors)
    && result.validationErrors.length > 0
    && (result.finalOutcome === "BUY_CANDIDATE" || result.finalOutcome === "SELL_CANDIDATE")
  ) {
    const semantic = result.validationErrors.some((e) =>
      /SEMANTIC|INVALID|SCHEMA/i.test(String(e.code ?? "") + String(e.message ?? "")),
    );
    if (semantic) {
      return {
        ok: false,
        validationStatus: "SEMANTIC_FAILURE",
        rejectionReason: result.validationErrors[0]?.message ?? "Semantic validation failure.",
      };
    }
  }

  return { ok: true, validationStatus: "VALID", rejectionReason: null };
}
