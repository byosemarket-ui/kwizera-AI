/**
 * Phase 5F STEP 3 — immutable PredictionSnapshot builder.
 * Rejects missing activation cutoff. Never substitutes now() or assessment timestamps.
 */
import {
  MIF_PREDICTION_OUTCOME_CONTRACT_ID,
  MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
  MIF_PREDICTION_SNAPSHOT_POLICY_ID,
  MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
} from "./contracts.js";
import { computePredictionId, computeSnapshotHash } from "./identity.js";
import { applyDirectionalSides, buildPredictionLevels } from "./levels.js";
import type {
  MifPredictionDirection,
  MifPredictionSnapshot,
  MifPredictionSnapshotBuildInput,
} from "./types.js";

function normalizeDirection(raw: string | null | undefined): MifPredictionDirection {
  const d = String(raw || "").trim().toUpperCase();
  if (d === "BUY" || d === "LONG") return "BUY";
  if (d === "SELL" || d === "SHORT") return "SELL";
  if (d === "NEUTRAL" || d === "FLAT") return "NEUTRAL";
  return "UNKNOWN";
}

function invalidSnapshot(
  partial: Omit<MifPredictionSnapshot, "status" | "invalidReason" | "snapshotHash"> & {
    invalidReason: string;
  },
): MifPredictionSnapshot {
  const body = {
    ...partial,
    status: "INVALID_INSUFFICIENT" as const,
  };
  const { snapshotHash: _ignore, ...hashBody } = body as MifPredictionSnapshot & {
    snapshotHash?: string;
  };
  void _ignore;
  return {
    ...body,
    snapshotHash: computeSnapshotHash(hashBody),
    invalidReason: partial.invalidReason,
  };
}

/**
 * Freeze an immutable prediction snapshot.
 * Requires authoritative activationOpenTimeSec — never falls back to now().
 */
export function buildPredictionSnapshot(
  input: MifPredictionSnapshotBuildInput,
): MifPredictionSnapshot {
  const candidateId = String(input.candidateId || "").trim();
  const instrument = String(input.instrument || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const direction = normalizeDirection(input.direction);
  const createdAt = input.createdAt ?? new Date().toISOString();

  const reasoningRunId = input.reasoningRunId ? String(input.reasoningRunId).trim() : null;
  const analysisRunId = input.analysisRunId ? String(input.analysisRunId).trim() : null;
  const evaluationId = input.evaluationId ? String(input.evaluationId).trim() : null;

  const levels = applyDirectionalSides(
    buildPredictionLevels({
      entryPrice: input.entryPrice,
      entrySide: input.entrySide,
      targetPrice: input.targetPrice,
      targetSide: input.targetSide,
      invalidationPrice: input.invalidationPrice,
      invalidationSide: input.invalidationSide,
      invalidationConditions: input.invalidationConditions,
      requiredConfirmations: input.requiredConfirmations,
      thesis: input.thesis,
      rationale: input.rationale,
    }),
    direction,
  );

  const baseCommon = {
    contractId: MIF_PREDICTION_OUTCOME_CONTRACT_ID,
    contractVersion: MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
    snapshotPolicyId: MIF_PREDICTION_SNAPSHOT_POLICY_ID,
    snapshotPolicyVersion: MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
    candidateId,
    reasoningRunId,
    evaluationId,
    analysisRunId,
    createdAt,
    activationTimestamp: input.activationTimestamp ?? null,
    instrument,
    timeframe,
    direction,
    levels,
    modelVersion: input.modelVersion ?? null,
    strategyVersion: input.strategyVersion ?? null,
    strategyId: input.strategyId ?? null,
    detectorId: input.detectorId ?? null,
    sourceAnalysisIdentity: input.sourceAnalysisIdentity ?? null,
    marketProvenance: input.marketProvenance ?? {
      mode: "UNBOUND" as const,
      providerId: "HFM_MT5" as const,
      note: "snapshot created without bound market provenance",
    },
    referenceCandle: input.referenceCandle ?? null,
    allowActivationCloseAsEntry: true as const,
    placesOrders: false as const,
    mutatesBroker: false as const,
    acceptsForExecution: false as const,
    analyticalOutcomeOnly: true as const,
    doesNotApproveAiReasoning: true as const,
    isNotCalibratedProbability: true as const,
    notExecutable: true as const,
  };

  if (!candidateId) {
    return invalidSnapshot({
      ...baseCommon,
      predictionId: "pred:invalid",
      activationOpenTimeSec: 0,
      invalidReason: "MISSING_CANDIDATE_ID",
    });
  }
  if (!instrument || !timeframe) {
    return invalidSnapshot({
      ...baseCommon,
      predictionId: "pred:invalid",
      activationOpenTimeSec: 0,
      invalidReason: "MISSING_INSTRUMENT_OR_TIMEFRAME",
    });
  }

  const activation = input.activationOpenTimeSec;
  if (
    activation == null
    || !Number.isFinite(activation)
    || activation <= 0
  ) {
    return invalidSnapshot({
      ...baseCommon,
      predictionId: "pred:invalid",
      activationOpenTimeSec: 0,
      invalidReason:
        "MISSING_ACTIVATION_CUTOFF: authoritative activationOpenTimeSec required; now()/assessmentTimestamp substitution forbidden",
    });
  }

  const predictionId = computePredictionId({
    candidateId,
    reasoningRunId,
    analysisRunId,
    evaluationId,
    activationOpenTimeSec: activation,
    instrument,
    timeframe,
    direction,
    snapshotPolicyVersion: MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
  });

  const draft = {
    ...baseCommon,
    predictionId,
    activationOpenTimeSec: activation,
    status: "FROZEN" as const,
    invalidReason: null,
  };

  return {
    ...draft,
    snapshotHash: computeSnapshotHash(draft),
  };
}

export function isPredictionSnapshotValid(
  snapshot: MifPredictionSnapshot,
): snapshot is MifPredictionSnapshot & { status: "FROZEN" } {
  return snapshot.status === "FROZEN" && snapshot.activationOpenTimeSec > 0;
}
