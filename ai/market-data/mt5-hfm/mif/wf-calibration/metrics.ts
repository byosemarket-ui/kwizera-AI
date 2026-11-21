/**
 * Phase 5F STEP 5 Phase C — WF calibration metrics (Brier, log loss, ECE, optional MCE).
 */
import {
  MIF_WF_CALIBRATION_BINNING_POLICY_ID,
  MIF_WF_CALIBRATION_BINNING_POLICY_VERSION,
  MIF_WF_CALIBRATION_DEFAULT_BIN_COUNT,
  MIF_WF_CALIBRATION_LOGLOSS_EPS,
  MIF_WF_CALIBRATION_MCE_MIN_BIN_COUNT,
  MIF_WF_CALIBRATION_MCE_MIN_TOTAL,
} from "./contracts.js";
import type { MifWfCalibrationMetrics, MifWfReliabilityBin } from "./types.js";

export function clippedLogLoss(p: number, y: 0 | 1, eps = MIF_WF_CALIBRATION_LOGLOSS_EPS): number {
  const q = Math.min(1 - eps, Math.max(eps, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

export function computeWfCalibrationMetrics(
  points: readonly { probability: number; outcome: 0 | 1 }[],
  binCount = MIF_WF_CALIBRATION_DEFAULT_BIN_COUNT,
): MifWfCalibrationMetrics {
  const notes: string[] = [];
  const n = points.length;
  if (n === 0) {
    return {
      brierScore: null,
      logLoss: null,
      expectedCalibrationError: null,
      maximumCalibrationError: null,
      mceSuppressedReason: "no_samples",
      reliabilityBins: [],
      sampleCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      classBalance: { positiveRate: null, negativeRate: null },
      binningPolicyId: MIF_WF_CALIBRATION_BINNING_POLICY_ID,
      binningPolicyVersion: MIF_WF_CALIBRATION_BINNING_POLICY_VERSION,
      logLossEps: MIF_WF_CALIBRATION_LOGLOSS_EPS,
      notes: ["no_prediction_outcome_pairs"],
    };
  }

  let brier = 0;
  let logSum = 0;
  let positives = 0;
  for (const p of points) {
    brier += (p.probability - p.outcome) ** 2;
    logSum += clippedLogLoss(p.probability, p.outcome);
    if (p.outcome === 1) positives += 1;
  }
  const negatives = n - positives;
  notes.push(`log_loss_clip_eps=${MIF_WF_CALIBRATION_LOGLOSS_EPS}`);
  if (positives === 0 || negatives === 0) {
    notes.push("class_imbalance_extreme_single_class");
  }

  const bins: MifWfReliabilityBin[] = [];
  if (n >= binCount * 2) {
    const sorted = [...points].sort((a, b) => a.probability - b.probability);
    const size = Math.floor(sorted.length / binCount) || 1;
    for (let i = 0; i < binCount; i++) {
      const slice = sorted.slice(
        i * size,
        i === binCount - 1 ? sorted.length : (i + 1) * size,
      );
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
    ece = bins.reduce(
      (a, b) => a + (b.count / n) * Math.abs(b.predictedMean - b.observedFrequency),
      0,
    );
  }

  let mce: number | null = null;
  let mceSuppressedReason: string | null = null;
  const binsOk =
    bins.length > 0
    && n >= MIF_WF_CALIBRATION_MCE_MIN_TOTAL
    && bins.every((b) => b.count >= MIF_WF_CALIBRATION_MCE_MIN_BIN_COUNT);
  if (binsOk) {
    mce = Math.max(
      ...bins.map((b) => Math.abs(b.predictedMean - b.observedFrequency)),
    );
  } else {
    mceSuppressedReason =
      bins.length === 0
        ? "no_reliability_bins"
        : `mce_requires_n>=${MIF_WF_CALIBRATION_MCE_MIN_TOTAL}_and_each_bin>=${MIF_WF_CALIBRATION_MCE_MIN_BIN_COUNT}`;
    notes.push(mceSuppressedReason);
  }

  return {
    brierScore: brier / n,
    logLoss: logSum / n,
    expectedCalibrationError: ece,
    maximumCalibrationError: mce,
    mceSuppressedReason,
    reliabilityBins: bins,
    sampleCount: n,
    positiveCount: positives,
    negativeCount: negatives,
    classBalance: {
      positiveRate: positives / n,
      negativeRate: negatives / n,
    },
    binningPolicyId: MIF_WF_CALIBRATION_BINNING_POLICY_ID,
    binningPolicyVersion: MIF_WF_CALIBRATION_BINNING_POLICY_VERSION,
    logLossEps: MIF_WF_CALIBRATION_LOGLOSS_EPS,
    notes,
  };
}

export function resolveWfStatusFromOosCount(
  n: number,
  opts: {
    temporalLeakage: boolean;
    incompatibleTarget: boolean;
    invalidProvenance: boolean;
    unfrozenOnly: boolean;
    provisionalThreshold: number;
    calibratedThreshold: number;
    /** Metrics-only Phase C never auto-promotes to CALIBRATED. */
    allowCalibratedClaim: boolean;
  },
): { status: import("./types.js").MifWfCalibrationStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (opts.temporalLeakage) {
    return { status: "REJECTED_TEMPORAL_LEAKAGE", reasons: ["temporal_leakage_detected"] };
  }
  if (opts.incompatibleTarget) {
    return { status: "INCOMPATIBLE_TARGET_EVENT", reasons: ["incompatible_target_event"] };
  }
  if (opts.invalidProvenance) {
    return { status: "INVALID_PROVENANCE", reasons: ["invalid_or_limited_provenance"] };
  }
  if (opts.unfrozenOnly && n === 0) {
    return { status: "UNFROZEN", reasons: ["no_high_trust_freezes"] };
  }
  if (n === 0) {
    return { status: "NOT_CALIBRATED", reasons: ["no_eligible_oos_observations"] };
  }
  if (n < opts.provisionalThreshold) {
    reasons.push(`n=${n}<provisional=${opts.provisionalThreshold}`);
    return { status: "INSUFFICIENT_DATA", reasons };
  }
  if (n < opts.calibratedThreshold) {
    reasons.push(`n=${n}<calibrated=${opts.calibratedThreshold}`);
    reasons.push("provisional_evaluation_only_not_calibrated");
    return { status: "PROVISIONAL_EVALUATION", reasons };
  }
  reasons.push(`n=${n}>=calibrated_threshold=${opts.calibratedThreshold}`);
  reasons.push("metrics_only_pipeline_no_frozen_calibrator_model");
  if (!opts.allowCalibratedClaim) {
    reasons.push("phase_c_metrics_only_blocks_calibrated_claim");
    return { status: "CALIBRATION_EVALUATED", reasons };
  }
  return { status: "CALIBRATED", reasons };
}
