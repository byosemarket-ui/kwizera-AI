/**
 * Phase 03 — canonical prediction score semantics for Charts / Admin / AI.
 * Prevents conflating analytical confidence, statistical probability,
 * historical win rate, and opportunity ranking.
 */

/** Analytical confidence — evidence strength for current interpretation. */
export const HFM_SCORE_KIND_ANALYTICAL_CONFIDENCE =
  "ANALYTICAL_CONFIDENCE" as const;

/** Statistical probability of a predefined event (requires sample + calibration). */
export const HFM_SCORE_KIND_ESTIMATED_PROBABILITY =
  "ESTIMATED_PROBABILITY" as const;

/** Observed frequency among completed decisive evaluations. */
export const HFM_SCORE_KIND_HISTORICAL_WIN_RATE =
  "HISTORICAL_WIN_RATE" as const;

/** Relative ranking among candidates — not a probability. */
export const HFM_SCORE_KIND_OPPORTUNITY_RANKING =
  "OPPORTUNITY_RANKING" as const;

export type HfmScoreKind =
  | typeof HFM_SCORE_KIND_ANALYTICAL_CONFIDENCE
  | typeof HFM_SCORE_KIND_ESTIMATED_PROBABILITY
  | typeof HFM_SCORE_KIND_HISTORICAL_WIN_RATE
  | typeof HFM_SCORE_KIND_OPPORTUNITY_RANKING;

export const HFM_SCORE_KIND_LABELS: Record<HfmScoreKind, string> = {
  ANALYTICAL_CONFIDENCE: "Analytical confidence",
  ESTIMATED_PROBABILITY: "Estimated probability",
  HISTORICAL_WIN_RATE: "Historical win rate",
  OPPORTUNITY_RANKING: "Opportunity ranking",
};

export const HFM_SCORE_KIND_DISCLAIMERS: Record<HfmScoreKind, string> = {
  ANALYTICAL_CONFIDENCE:
    "How strongly current evidence supports the interpretation — not win probability.",
  ESTIMATED_PROBABILITY:
    "Statistical likelihood of a predefined event, only when sample and calibration allow.",
  HISTORICAL_WIN_RATE:
    "Observed success frequency among completed decisive records — not a future probability.",
  OPPORTUNITY_RANKING:
    "Relative candidate priority among peers — not probability or win rate.",
};

/**
 * Charts Analyze Now orchestration uses skipProbability: true.
 * Probability must display as unavailable — never substitute confidence.
 */
export type HfmChartsProbabilityAvailability =
  | "NOT_AVAILABLE"
  | "INSUFFICIENT_DATA"
  | "PROVISIONAL"
  | "CALIBRATED"
  | "DEGRADED";

export const HFM_CHARTS_PROBABILITY_AVAILABILITY_DEFAULT: HfmChartsProbabilityAvailability =
  "NOT_AVAILABLE";

export const HFM_CHARTS_PROBABILITY_UNAVAILABLE_REASON =
  "Charts_path_skipProbability_ranking_only_not_calibrated_probability" as const;

/** Minimum paired observations before provisional confidence↔outcome diagnostics. */
export const HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN = 30 as const;

/** Minimum paired observations before diagnostic metrics are considered ready (still not probability calibration). */
export const HFM_CHARTS_CONFIDENCE_OUTCOME_DIAGNOSTIC_MIN = 100 as const;

export type HfmChartsConfidenceOutcomeDiagnosticStatus =
  | "NO_PAIRS"
  | "INSUFFICIENT_DATA"
  | "PROVISIONAL_DIAGNOSTIC"
  | "DIAGNOSTIC_READY_NOT_PROBABILITY_CALIBRATION";

export function classifyConfidenceOutcomeDiagnosticStatus(
  pairCount: number,
): HfmChartsConfidenceOutcomeDiagnosticStatus {
  if (pairCount <= 0) return "NO_PAIRS";
  if (pairCount < HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN) {
    return "INSUFFICIENT_DATA";
  }
  if (pairCount < HFM_CHARTS_CONFIDENCE_OUTCOME_DIAGNOSTIC_MIN) {
    return "PROVISIONAL_DIAGNOSTIC";
  }
  return "DIAGNOSTIC_READY_NOT_PROBABILITY_CALIBRATION";
}
