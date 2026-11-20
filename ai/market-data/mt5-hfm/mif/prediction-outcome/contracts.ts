/**
 * Phase 5F STEP 3 — Prediction Outcome & Historical Performance contracts.
 * Analytical only. Not calibrated probability. Not executable.
 */

export const MIF_PREDICTION_OUTCOME_CONTRACT_ID =
  "kwizera.mif.prediction-outcome.v1" as const;
export const MIF_PREDICTION_OUTCOME_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_PREDICTION_OUTCOME_ENGINE_ID =
  "mif-prediction-outcome-engine" as const;
export const MIF_PREDICTION_OUTCOME_ENGINE_VERSION = "1.0.0" as const;

export const MIF_PREDICTION_SNAPSHOT_POLICY_ID =
  "prediction-snapshot-policy" as const;
export const MIF_PREDICTION_SNAPSHOT_POLICY_VERSION = "1.0.0" as const;

export const MIF_PREDICTION_PATH_METRICS_POLICY_ID =
  "prediction-path-metrics-policy" as const;
export const MIF_PREDICTION_PATH_METRICS_POLICY_VERSION = "1.0.0" as const;

export const MIF_PREDICTION_PERFORMANCE_POLICY_ID =
  "prediction-performance-policy" as const;
export const MIF_PREDICTION_PERFORMANCE_POLICY_VERSION = "1.0.0" as const;

/** Default forward horizons in CLOSED candles after activation (exclusive). */
export const MIF_PREDICTION_DEFAULT_HORIZONS = [4, 8, 16] as const;

/** Hard caps for VPS-safe evaluation. */
export const MIF_PREDICTION_MAX_OBSERVATION_BARS = 10_000 as const;
export const MIF_PREDICTION_MAX_API_LIST = 100 as const;
export const MIF_PREDICTION_DEFAULT_API_LIST = 50 as const;

export const MIF_PREDICTION_MARKET_SOURCE_MODES = [
  "HISTORICAL_ARCHIVE",
  "LIVE_COPYRATES",
] as const;

export const MIF_PREDICTION_DIRECTIONS = [
  "BUY",
  "SELL",
  "NEUTRAL",
  "UNKNOWN",
] as const;

export const MIF_PREDICTION_HORIZON_COMPLETENESS = [
  "COMPLETE",
  "PARTIAL",
  "INSUFFICIENT",
  "UNSUPPORTED_DIRECTION",
  "INVALID_ENTRY",
] as const;

export const MIF_PREDICTION_ENTRY_REFERENCE_KINDS = [
  "STRUCTURED_ENTRY",
  "ACTIVATION_CLOSE",
  "MISSING",
] as const;

export const MIF_PREDICTION_LEVEL_PARSE_PROVENANCE = [
  "STRUCTURED_INPUT",
  "LEGACY_NOTES_PARSE",
  "MISSING",
  "MIXED",
] as const;
