/**
 * P8.A — Charts → MIF Prediction Outcome bridge contracts.
 * Analytical only. No broker mutation. No competing lifecycle FSM.
 */

export const HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID =
  "kwizera.hfm.charts-prediction-bridge.v1" as const;
export const HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION = "1.0.0" as const;
export const HFM_CHARTS_PREDICTION_BRIDGE_ID =
  "hfm-charts-prediction-bridge" as const;
export const HFM_CHARTS_PREDICTION_BRIDGE_VERSION = "1.0.0" as const;

/** Stable sourceAnalysisIdentity prefix for Charts analysis records. */
export const HFM_CHARTS_SOURCE_ANALYSIS_PREFIX = "hfm-charts:" as const;

export const HFM_CHARTS_PREDICTION_BRIDGE_SKIP_REASONS = [
  "NOT_COMPLETED",
  "NO_RESULT",
  "NO_TRADE",
  "WAITING",
  "MISSING_LEVELS",
  "INVALID_LEVELS",
  "MISSING_ACTIVATION",
  "MISSING_INSTRUMENT_OR_TIMEFRAME",
  "SNAPSHOT_INVALID",
  "PERSIST_CONFLICT",
  "PERSIST_FAILED",
] as const;
