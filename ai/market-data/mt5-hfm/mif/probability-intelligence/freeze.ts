/**
 * Phase 5F STEP 5 Phase B — immutable prediction-time probability freeze.
 *
 * Never reconstruct probability from later outcomes.
 * Never substitute wall-clock now for missing predictedAt.
 * Never overwrite an existing freeze; revisions are new immutable records.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  MIF_PROBABILITY_FREEZE_CONTRACT_ID,
  MIF_PROBABILITY_FREEZE_CONTRACT_VERSION,
  MIF_PROBABILITY_FREEZE_ENGINE_ID,
  MIF_PROBABILITY_FREEZE_ENGINE_VERSION,
  MIF_PROBABILITY_FREEZE_SCALE,
} from "./freeze-contracts.js";
import type {
  MifAssessmentFreezeStatus,
  MifProbabilityFreezeBuildInput,
  MifProbabilityFreezeBuildResult,
  MifProbabilityFreezeRecord,
} from "./freeze-types.js";
import type { MifProbabilityAssessment } from "./types.js";

const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isValidIsoTimestamp(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string" || !value.trim()) return false;
  if (!ISO_RE.test(value.trim())) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export function isValidUnitProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

/**
 * Deterministic freeze identity from immutable prediction-time fields.
 * Revision ordinal and supersedes are included so corrections get new ids.
 */
export function computeProbabilityFreezeId(fields: {
  assessmentId: string;
  predictionId: string | null;
  probability: number;
  predictedAt: string;
  targetEvent: string;
  policyVersion: string;
  engineVersion: string;
  revisionOrdinal: number;
  supersedesFreezeId: string | null;
}): string {
  const digest = hashPayload({
    kind: "probability-freeze",
    ...fields,
    contract: MIF_PROBABILITY_FREEZE_CONTRACT_VERSION,
  });
  return `pfrz:${digest.slice(0, 28)}`;
}

export function buildProbabilityFreeze(
  input: MifProbabilityFreezeBuildInput,
): MifProbabilityFreezeBuildResult {
  const a = input.assessment;
  if (!a || typeof a !== "object") {
    return { ok: false, code: "ASSESSMENT_REQUIRED", message: "assessment is required" };
  }
  if (a.providerId !== "HFM_MT5") {
    return {
      ok: false,
      code: "PROVIDER_ISOLATION",
      message: "probability freeze requires HFM_MT5 assessments only",
    };
  }
  if (!a.assessmentId || !String(a.assessmentId).trim()) {
    return { ok: false, code: "ASSESSMENT_ID_REQUIRED", message: "assessmentId is required" };
  }
  if (!isValidUnitProbability(a.probability)) {
    return {
      ok: false,
      code: "INVALID_PROBABILITY",
      message: "probability must be a finite number in [0,1]; null/invalid cannot be frozen",
    };
  }
  if (!isValidIsoTimestamp(a.calculatedAt)) {
    return {
      ok: false,
      code: "MISSING_PREDICTED_AT",
      message:
        "assessment.calculatedAt is required for audit; wall-clock now is never substituted",
    };
  }
  const assessmentCalculatedAt = a.calculatedAt.trim();

  // Resolve trustworthy prediction-time provenance (never invent now).
  let predictedAt = assessmentCalculatedAt;
  let predictionTimeProvenance: import("./freeze-types.js").MifPredictionTimeProvenanceKind =
    "ASSESSMENT_CALCULATED_AT_LIMITED";
  let provenanceTrust: import("./freeze-types.js").MifProvenanceTrust = "LIMITED";
  let snapshotActivationAt: string | null = null;

  const explicitAvail =
    input.predictionAvailableAt != null && String(input.predictionAvailableAt).trim()
      ? String(input.predictionAvailableAt).trim()
      : null;
  const snapAct =
    input.snapshotActivationAt != null && String(input.snapshotActivationAt).trim()
      ? String(input.snapshotActivationAt).trim()
      : null;

  if (explicitAvail) {
    if (!isValidIsoTimestamp(explicitAvail)) {
      return {
        ok: false,
        code: "INVALID_PREDICTION_AVAILABLE_AT",
        message: "predictionAvailableAt must be a valid ISO timestamp when provided",
      };
    }
    predictedAt = explicitAvail;
    predictionTimeProvenance = "EXPLICIT_PREDICTION_AVAILABLE_AT";
    provenanceTrust = "HIGH";
  } else if (snapAct) {
    if (!isValidIsoTimestamp(snapAct)) {
      return {
        ok: false,
        code: "INVALID_SNAPSHOT_ACTIVATION_AT",
        message: "snapshotActivationAt must be a valid ISO timestamp when provided",
      };
    }
    // Assessment calculated after snapshot activation is untrustworthy for prediction-time claims.
    if (assessmentCalculatedAt > snapAct) {
      return {
        ok: false,
        code: "UNTRUSTWORTHY_CALCULATED_AT",
        message:
          "assessment.calculatedAt post-dates snapshot activation; cannot establish prediction-time provenance",
      };
    }
    predictedAt = assessmentCalculatedAt;
    snapshotActivationAt = snapAct;
    predictionTimeProvenance = "SNAPSHOT_ACTIVATION";
    provenanceTrust = "HIGH";
  }
  // else LIMITED: calculatedAt alone — freeze allowed but excluded from WF calibration eligibility

  const outcomeResolvedAt = input.outcomeResolvedAt ?? null;
  if (outcomeResolvedAt != null && String(outcomeResolvedAt).trim()) {
    if (!isValidIsoTimestamp(outcomeResolvedAt)) {
      return {
        ok: false,
        code: "INVALID_OUTCOME_RESOLVED_AT",
        message: "outcomeResolvedAt must be a valid ISO timestamp when provided",
      };
    }
    if (outcomeResolvedAt.trim() <= predictedAt) {
      return {
        ok: false,
        code: "ASSESSMENT_AFTER_OUTCOME",
        message:
          "probability may be frozen only when predictedAt strictly precedes outcome resolution",
      };
    }
    if (assessmentCalculatedAt >= outcomeResolvedAt.trim()) {
      return {
        ok: false,
        code: "ASSESSMENT_AFTER_OUTCOME",
        message:
          "assessment.calculatedAt must strictly precede outcome resolution (no post-outcome reconstruction)",
      };
    }
  }

  // Freeze preserves exact target-event semantics; win-probability path only.
  if (a.targetEvent !== "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON") {
    return {
      ok: false,
      code: "UNSUPPORTED_TARGET_EVENT",
      message:
        "freeze requires TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON (historical frequency-only assessments are not frozen as win probabilities)",
    };
  }
  if (!a.isWinProbability) {
    return {
      ok: false,
      code: "NOT_WIN_PROBABILITY",
      message: "freeze requires isWinProbability=true assessments",
    };
  }

  const predictionId =
    input.predictionId != null && String(input.predictionId).trim()
      ? String(input.predictionId).trim()
      : null;
  const revisionOrdinal = Math.max(1, input.revisionOrdinal ?? 1);
  const supersedesFreezeId =
    input.supersedesFreezeId != null && String(input.supersedesFreezeId).trim()
      ? String(input.supersedesFreezeId).trim()
      : null;
  if (revisionOrdinal > 1 && !supersedesFreezeId) {
    return {
      ok: false,
      code: "REVISION_PROVENANCE_REQUIRED",
      message: "revisions require supersedesFreezeId provenance",
    };
  }
  if (revisionOrdinal === 1 && supersedesFreezeId) {
    return {
      ok: false,
      code: "INVALID_REVISION",
      message: "revisionOrdinal=1 cannot supersede another freeze",
    };
  }

  const frozenAt =
    input.frozenAt && isValidIsoTimestamp(input.frozenAt)
      ? input.frozenAt.trim()
      : // frozenAt is persistence metadata only — still must be ISO; tests may inject.
        // When omitted, derive a deterministic metadata stamp from predictedAt (NOT "now").
        predictedAt;

  const freezeId = computeProbabilityFreezeId({
    assessmentId: a.assessmentId,
    predictionId,
    probability: a.probability,
    predictedAt,
    targetEvent: a.targetEvent,
    policyVersion: a.policyVersion,
    engineVersion: a.engineVersion,
    revisionOrdinal,
    supersedesFreezeId,
  });

  const body = {
    assessmentId: a.assessmentId,
    predictionId,
    candidateId: a.candidateId,
    analysisRunId: a.analysisRunId,
    probability: a.probability,
    probabilityScale: MIF_PROBABILITY_FREEZE_SCALE,
    predictedAt,
    assessmentCalculatedAt,
    predictionTimeProvenance,
    provenanceTrust,
    snapshotActivationAt,
    targetEvent: a.targetEvent,
    targetEventDefinition: a.targetEventDefinition,
    policyId: a.policyId,
    policyVersion: a.policyVersion,
    engineId: MIF_PROBABILITY_FREEZE_ENGINE_ID,
    engineVersion: MIF_PROBABILITY_FREEZE_ENGINE_VERSION,
    assessmentEngineVersion: a.engineVersion,
    assessmentPolicyVersion: a.policyVersion,
    providerId: "HFM_MT5" as const,
    providerSymbol: a.providerSymbol,
    direction: a.direction,
    primaryTimeframe: a.primaryTimeframe,
    evaluationHorizonBars: a.evaluationHorizonBars,
    sourceDatasetId: input.sourceDatasetId ?? null,
    sourceDatasetVersion: input.sourceDatasetVersion ?? null,
    sourceContentHash: input.sourceContentHash ?? null,
    calibrationStatusAtFreeze: a.calibrationStatus,
    revisionOrdinal,
    supersedesFreezeId,
    revisionReason: input.revisionReason ?? null,
  };

  const freezeHash = hashPayload(body);
  const inputIdentity = hashPayload({
    assessmentInputIdentity: a.inputIdentity,
    freezeHash,
  });

  const freeze: MifProbabilityFreezeRecord = {
    contractId: MIF_PROBABILITY_FREEZE_CONTRACT_ID,
    contractVersion: MIF_PROBABILITY_FREEZE_CONTRACT_VERSION,
    freezeId,
    freezeHash,
    ...body,
    frozenAt,
    freezeStatus: "FROZEN",
    calibrationClaim: "NOT_CALIBRATED",
    isCalibratedProbability: false,
    isWalkForwardCalibrated: false,
    inputIdentity,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalFreezeOnly: true,
    notExecutable: true,
  };

  return { ok: true, freeze };
}

/**
 * Explicit immutable revision — never mutates the prior freeze record.
 */
export function buildProbabilityFreezeRevision(input: {
  prior: MifProbabilityFreezeRecord;
  assessment: MifProbabilityAssessment;
  revisionReason: string;
  outcomeResolvedAt?: string | null;
  sourceDatasetId?: string | null;
  sourceDatasetVersion?: number | null;
  sourceContentHash?: string | null;
  frozenAt?: string;
}): MifProbabilityFreezeBuildResult {
  if (!input.revisionReason || !String(input.revisionReason).trim()) {
    return {
      ok: false,
      code: "REVISION_REASON_REQUIRED",
      message: "revisionReason is required for freeze corrections",
    };
  }
  return buildProbabilityFreeze({
    assessment: input.assessment,
    predictionId: input.prior.predictionId,
    predictionAvailableAt:
      input.prior.predictionTimeProvenance === "EXPLICIT_PREDICTION_AVAILABLE_AT"
        ? input.prior.predictedAt
        : null,
    snapshotActivationAt: input.prior.snapshotActivationAt,
    outcomeResolvedAt: input.outcomeResolvedAt,
    sourceDatasetId: input.sourceDatasetId ?? input.prior.sourceDatasetId,
    sourceDatasetVersion: input.sourceDatasetVersion ?? input.prior.sourceDatasetVersion,
    sourceContentHash: input.sourceContentHash ?? input.prior.sourceContentHash,
    frozenAt: input.frozenAt,
    revisionOrdinal: input.prior.revisionOrdinal + 1,
    supersedesFreezeId: input.prior.freezeId,
    revisionReason: String(input.revisionReason).trim(),
  });
}

export function resolveAssessmentFreezeStatus(input: {
  assessment: MifProbabilityAssessment;
  freeze: MifProbabilityFreezeRecord | null;
}): MifAssessmentFreezeStatus {
  const reasons: string[] = [];
  if (!input.freeze) {
    reasons.push("no_immutable_prediction_time_freeze");
    if (input.assessment.probability == null) {
      reasons.push("assessment_probability_null");
    }
    if (!isValidIsoTimestamp(input.assessment.calculatedAt)) {
      reasons.push("missing_predicted_at");
    }
    return {
      assessmentId: input.assessment.assessmentId,
      lifecycle: "UNFROZEN",
      freezeId: null,
      predictionId: null,
      calibrationClaim: "NOT_CALIBRATED",
      reasons,
    };
  }
  return {
    assessmentId: input.assessment.assessmentId,
    lifecycle: "FROZEN",
    freezeId: input.freeze.freezeId,
    predictionId: input.freeze.predictionId,
    calibrationClaim: "NOT_CALIBRATED",
    reasons: ["frozen_prediction_time_probability_not_calibrated_model"],
  };
}
