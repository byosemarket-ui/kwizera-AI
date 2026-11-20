/**
 * Phase 5E Step 2 — chronological calibration / validation foundation.
 *
 * Without timestamped historical *probability assessments* that predate their
 * resolved outcomes, genuine OOS calibration is UNAVAILABLE / UNCALIBRATED.
 * Never reconstruct past predictions using information unavailable at the time.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  MIF_CALIBRATION_CONTRACT_ID,
  MIF_CALIBRATION_CONTRACT_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_POLICY_VERSION,
} from "./contracts.js";
import { resolveProbabilityPolicy } from "./policies.js";
import type {
  MifCalibrationMetrics,
  MifCalibrationRun,
  MifCalibrationStatus,
  MifProbabilityAssessment,
  MifProbabilityPolicy,
} from "./types.js";

export interface HistoricalPredictionPoint {
  /** When the probability was assigned (must precede outcome resolution). */
  predictedAt: string;
  /** Assigned probability in [0,1]. */
  probability: number;
  /** Binary outcome: 1 = success (TARGET_REACHED), 0 = failure (INVALIDATION). */
  outcome: 0 | 1;
  /** When outcome was resolved — must be > predictedAt. */
  resolvedAt: string;
  candidateId: string;
}

function safeLogLoss(p: number, y: 0 | 1): number {
  const eps = 1e-15;
  const q = Math.min(1 - eps, Math.max(eps, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

/**
 * Compute calibration metrics on a chronological validation set.
 * Callers must ensure points are OOS relative to any training that produced the model.
 */
export function computeCalibrationMetrics(
  points: readonly HistoricalPredictionPoint[],
  windows: {
    trainingWindow: { fromIso: string | null; toIso: string | null };
    validationWindow: { fromIso: string | null; toIso: string | null };
  },
  binCount = 5,
): MifCalibrationMetrics {
  const notes: string[] = [];
  if (points.length === 0) {
    return {
      brierScore: null,
      logLoss: null,
      expectedCalibrationError: null,
      reliabilityBins: [],
      calibrationSampleCount: 0,
      trainingWindow: windows.trainingWindow,
      validationWindow: windows.validationWindow,
      notes: ["no_prediction_outcome_pairs"],
    };
  }

  // Chronological integrity check
  let leakage = 0;
  for (const p of points) {
    if (p.resolvedAt <= p.predictedAt) leakage += 1;
  }
  if (leakage) notes.push(`temporal_integrity_violations=${leakage}`);

  const valid = points.filter((p) => p.resolvedAt > p.predictedAt);
  let brier = 0;
  let logLossSum = 0;
  for (const p of valid) {
    brier += (p.probability - p.outcome) ** 2;
    logLossSum += safeLogLoss(p.probability, p.outcome);
  }
  const n = valid.length;
  const brierScore = n ? brier / n : null;
  const logLoss = n ? logLossSum / n : null;

  const bins: MifCalibrationMetrics["reliabilityBins"][number][] = [];
  if (n >= binCount * 2) {
    const sorted = [...valid].sort((a, b) => a.probability - b.probability);
    const size = Math.floor(sorted.length / binCount) || 1;
    for (let i = 0; i < binCount; i++) {
      const slice = sorted.slice(i * size, i === binCount - 1 ? sorted.length : (i + 1) * size);
      if (!slice.length) continue;
      const predictedMean = slice.reduce((a, x) => a + x.probability, 0) / slice.length;
      const observedFrequency = slice.reduce((a, x) => a + x.outcome, 0) / slice.length;
      bins.push({
        binIndex: i,
        predictedMean,
        observedFrequency,
        count: slice.length,
      });
    }
  } else {
    notes.push("insufficient_for_reliability_bins");
  }

  let ece: number | null = null;
  if (bins.length && n) {
    ece = bins.reduce((a, b) => a + (b.count / n) * Math.abs(b.predictedMean - b.observedFrequency), 0);
  }

  return {
    brierScore,
    logLoss,
    expectedCalibrationError: ece,
    reliabilityBins: bins,
    calibrationSampleCount: n,
    trainingWindow: windows.trainingWindow,
    validationWindow: windows.validationWindow,
    notes,
  };
}

export function resolveCalibrationStatus(
  metrics: MifCalibrationMetrics | null,
  policy: MifProbabilityPolicy = resolveProbabilityPolicy(),
): MifCalibrationStatus {
  if (!metrics || metrics.calibrationSampleCount === 0) return "UNAVAILABLE";
  if (metrics.notes.some((n) => n.startsWith("temporal_integrity_violations"))) {
    return "VALIDATION_FAILED";
  }
  if (metrics.calibrationSampleCount < policy.minSampleForProvisionalCalibration) {
    return "INSUFFICIENT_SAMPLE";
  }
  if (metrics.calibrationSampleCount < policy.minSampleForCalibration) {
    return "PROVISIONALLY_CALIBRATED";
  }
  return "CALIBRATED";
}

/**
 * Build a calibration run from historical probability assessments that already exist.
 * If none are provided, returns UNCALIBRATED / UNAVAILABLE foundation (expected early state).
 */
export function buildCalibrationRun(input: {
  historicalAssessments: readonly MifProbabilityAssessment[];
  /** Map candidateId → resolved binary outcome and resolution time. */
  resolvedOutcomes: ReadonlyMap<string, { outcome: 0 | 1; resolvedAt: string }>;
  trainingCutoffIso?: string | null;
  calculatedAt?: string;
  policy?: Partial<MifProbabilityPolicy> | null;
}): MifCalibrationRun {
  const policy = resolveProbabilityPolicy(input.policy);
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();
  const cutoff = input.trainingCutoffIso ?? null;

  const points: HistoricalPredictionPoint[] = [];
  for (const a of input.historicalAssessments) {
    if (a.probability == null || !a.isWinProbability) continue;
    const res = input.resolvedOutcomes.get(a.candidateId);
    if (!res) continue;
    if (res.resolvedAt <= a.calculatedAt) continue; // would be leakage / invalid
    if (cutoff && a.calculatedAt > cutoff) continue; // keep predictions in training side of split for pairing below
    points.push({
      predictedAt: a.calculatedAt,
      probability: a.probability,
      outcome: res.outcome,
      resolvedAt: res.resolvedAt,
      candidateId: a.candidateId,
    });
  }

  // Chronological split: train = earlier half by predictedAt; validate = later half
  const sorted = [...points].sort((a, b) => a.predictedAt.localeCompare(b.predictedAt));
  const mid = Math.floor(sorted.length / 2);
  const training = sorted.slice(0, mid);
  const validation = sorted.slice(mid);
  // Metrics computed on VALIDATION only (OOS)
  const metrics = computeCalibrationMetrics(validation, {
    trainingWindow: {
      fromIso: training[0]?.predictedAt ?? null,
      toIso: training[training.length - 1]?.predictedAt ?? null,
    },
    validationWindow: {
      fromIso: validation[0]?.predictedAt ?? null,
      toIso: validation[validation.length - 1]?.predictedAt ?? null,
    },
  });

  let status = resolveCalibrationStatus(metrics, policy);
  if (sorted.length === 0) status = "UNCALIBRATED";

  const datasetIdentity = createHash("sha256")
    .update(
      stableSerialize({
        n: sorted.length,
        ids: sorted.map((p) => p.candidateId).sort(),
        engine: MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
        policy: MIF_PROBABILITY_INTELLIGENCE_POLICY_VERSION,
      }),
    )
    .digest("hex");

  return {
    contractId: MIF_CALIBRATION_CONTRACT_ID,
    contractVersion: MIF_CALIBRATION_CONTRACT_VERSION,
    calibrationRunId: `cal:${datasetIdentity.slice(0, 24)}`,
    status,
    metrics: sorted.length === 0 ? null : metrics,
    modelVersion: MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
    policyVersion: policy.policyVersion,
    datasetIdentity,
    calculatedAt,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
  };
}
