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
export const HFM_CHARTS_PERFORMANCE_POLICY_VERSION = "1.0.0" as const;

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
