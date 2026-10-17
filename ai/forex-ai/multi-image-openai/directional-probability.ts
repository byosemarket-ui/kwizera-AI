/**
 * Phase 50D — Directional probability honesty gate.
 *
 * Empirical calibration requires a prediction journal with labeled outcomes,
 * held-out evaluation, and enough representative observations.
 * This codebase has no such journal — do not fabricate percentages or
 * relabel evidence scores as win probabilities.
 */

export const DIRECTIONAL_PROBABILITY_STATUS = "NOT_CALIBRATED" as const;
export const DIRECTIONAL_PROBABILITY_METHOD = "phase50d-calibration-gate-v1";

export interface DirectionalProbabilityReport {
  schemaVersion: "forex-directional-probability-v1";
  status: typeof DIRECTIONAL_PROBABILITY_STATUS;
  display: "DIRECTIONAL PROBABILITY: NOT CALIBRATED";
  method: typeof DIRECTIONAL_PROBABILITY_METHOD;
  bullishProbabilityPercent: null;
  bearishProbabilityPercent: null;
  /** Explicit: evidence score is not a probability. */
  evidenceScoreIsNotProbability: true;
  sampleCount: 0;
  calibrationPeriod: null;
  lastUpdatedAtUtc: null;
  predictionHorizon: null;
  outcomeDefinition: null;
  evaluationSeparatedFromCalibration: null;
  brierScore: null;
  logLoss: null;
  reliabilityBins: null;
  reason:
    "No historical prediction journal with labeled directional outcomes exists for empirical calibration.";
  note:
    "Evidence score / directional confidence measures analytical lean only — never display it as P(win) or directional probability.";
}

/**
 * Always returns NOT CALIBRATED until a real journal + calibration pipeline exists.
 * Synthetic fixtures must never flip this to calibrated.
 */
export function resolveDirectionalProbability(_input?: {
  /** Reserved — journal lookup would go here. */
  instrument?: string | null;
  timeframe?: string | null;
}): DirectionalProbabilityReport {
  return {
    schemaVersion: "forex-directional-probability-v1",
    status: DIRECTIONAL_PROBABILITY_STATUS,
    display: "DIRECTIONAL PROBABILITY: NOT CALIBRATED",
    method: DIRECTIONAL_PROBABILITY_METHOD,
    bullishProbabilityPercent: null,
    bearishProbabilityPercent: null,
    evidenceScoreIsNotProbability: true,
    sampleCount: 0,
    calibrationPeriod: null,
    lastUpdatedAtUtc: null,
    predictionHorizon: null,
    outcomeDefinition: null,
    evaluationSeparatedFromCalibration: null,
    brierScore: null,
    logLoss: null,
    reliabilityBins: null,
    reason:
      "No historical prediction journal with labeled directional outcomes exists for empirical calibration.",
    note:
      "Evidence score / directional confidence measures analytical lean only — never display it as P(win) or directional probability.",
  };
}

/** True only when a real calibration payload is present — never for synthetic fixtures alone. */
export function isEmpiricallyCalibrated(report: DirectionalProbabilityReport): boolean {
  return (
    report.status !== "NOT_CALIBRATED"
    && report.sampleCount > 0
    && report.bullishProbabilityPercent != null
    && report.evaluationSeparatedFromCalibration === true
  );
}
