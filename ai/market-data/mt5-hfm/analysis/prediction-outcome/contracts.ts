/**
 * P8.C — Charts Deterministic Outcome Evaluation contracts.
 * Analytical OHLC research only. Not broker P&L. Not calibrated probability.
 */

export const HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID =
  "kwizera.hfm.charts-prediction-outcome.v1" as const;
export const HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION = "1.0.0" as const;

export const HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_ID =
  "hfm-charts-prediction-outcome" as const;
/** P8.C evaluator: entry-trigger separation + direction-aware signed R. */
export const HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION = "1.0.0" as const;

export const HFM_CHARTS_ENTRY_TRIGGER_POLICY_ID =
  "hfm-charts-entry-trigger-policy" as const;
export const HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION = "1.0.0" as const;

export const HFM_CHARTS_SIGNED_R_POLICY_ID =
  "hfm-charts-signed-r-policy" as const;
export const HFM_CHARTS_SIGNED_R_POLICY_VERSION = "1.0.0" as const;

export const HFM_CHARTS_PERFORMANCE_POLICY_ID =
  "hfm-charts-prediction-performance-policy" as const;
/** P8.C baseline summary. */
export const HFM_CHARTS_PERFORMANCE_POLICY_VERSION = "1.0.0" as const;
/** P8.D analytics: filters, breakdowns, signed-R/MAE distributions, trigger rate. */
export const HFM_CHARTS_PERFORMANCE_ANALYTICS_POLICY_VERSION = "1.1.0" as const;

export const HFM_CHARTS_PERFORMANCE_ANALYTICS_SCHEMA_VERSION = "1" as const;

export const HFM_CHARTS_ANALYTICAL_CONFIDENCE_LABEL =
  "Analytical confidence — not win probability." as const;

export const HFM_CHARTS_INSUFFICIENT_SAMPLE_THRESHOLD = 100 as const;

export const HFM_CHARTS_CONFIDENCE_BUCKETS = [
  "UNKNOWN",
  "<0.5",
  "0.5–0.75",
  "≥0.75",
] as const;

export const HFM_CHARTS_TIME_BASIS = [
  "activationOpenTimeSec",
  "computationTimestamp",
] as const;

export const HFM_CHARTS_POPULATION_MODES = [
  "LATEST_PER_PREDICTION",
  "PER_PIT_MANIFEST",
] as const;

/** Legacy MIF prediction-outcome engine version preserved for historical records. */
export const HFM_CHARTS_LEGACY_MIF_EVALUATOR_VERSION = "1.0.0" as const;

/**
 * Signed R definition (P8.C):
 * R = ((exitPrice - entryPrice) * directionSign) / |entryPrice - invalidationPrice|
 * BUY directionSign = +1; SELL directionSign = -1.
 */
export const HFM_CHARTS_SIGNED_R_DEFINITION =
  "((exitPrice - entryPrice) * directionSign) / abs(entryPrice - invalidationPrice); BUY=+1 SELL=-1; analytical OHLC only; NOT broker fill P&L; NOT win probability" as const;

export const HFM_CHARTS_TRIGGER_CANDLE_LEVEL_POLICY =
  "EXCLUDE_TRIGGER_CANDLE_FROM_LEVEL_EVAL" as const;

export const HFM_CHARTS_ENTRY_ZONE_TOUCH_RULE =
  "CLOSED_CANDLE_RANGE_INTERSECTS_ZONE_AFTER_ACTIVATION" as const;
