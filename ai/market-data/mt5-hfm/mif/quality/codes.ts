/**
 * Phase 5B.2 Step 1 — stable reason / finding codes.
 */

/** Hard integrity / blocking codes */
export const MIF_QI_INVALID_OHLC = "INVALID_OHLC" as const;
export const MIF_QI_INVALID_TIMESTAMP = "INVALID_TIMESTAMP" as const;
export const MIF_QI_INVALID_INTERVAL = "INVALID_INTERVAL" as const;
export const MIF_QI_PROVIDER_MISMATCH = "PROVIDER_MISMATCH" as const;
export const MIF_QI_SYMBOL_MISMATCH = "SYMBOL_MISMATCH" as const;
export const MIF_QI_TIMEFRAME_MISMATCH = "TIMEFRAME_MISMATCH" as const;
export const MIF_QI_DUPLICATE_OPEN = "DUPLICATE_OPEN" as const;
export const MIF_QI_DUPLICATE_INTERVAL = "DUPLICATE_INTERVAL" as const;
export const MIF_QI_CONFLICTING_CANDLE = "CONFLICTING_CANDLE" as const;
export const MIF_QI_OUT_OF_ORDER = "OUT_OF_ORDER" as const;
export const MIF_QI_OVERLAPPING_INTERVAL = "OVERLAPPING_INTERVAL" as const;
export const MIF_QI_UNEXPECTED_DURATION = "UNEXPECTED_DURATION" as const;
export const MIF_QI_UNSUPPORTED_CANDLE_STATE = "UNSUPPORTED_CANDLE_STATE" as const;
export const MIF_QI_MALFORMED_FIELD = "MALFORMED_FIELD" as const;

/** Gap / uncertainty codes */
export const MIF_QI_CONFIRMED_MISSING = "CONFIRMED_MISSING" as const;
export const MIF_QI_POSSIBLE_GAP = "POSSIBLE_GAP" as const;
export const MIF_QI_UNKNOWN_SESSION_GAP = "UNKNOWN_SESSION_GAP" as const;
export const MIF_QI_INSUFFICIENT_HISTORY = "INSUFFICIENT_HISTORY" as const;
export const MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR =
  "NO_AUTHORITATIVE_SESSION_CALENDAR" as const;
export const MIF_QI_TIMEBASE_UNCERTAIN = "TIMEBASE_UNCERTAIN" as const;
export const MIF_QI_TIMEBASE_MIXED = "TIMEBASE_MIXED" as const;
export const MIF_QI_DURATION_UNSUPPORTED = "DURATION_UNSUPPORTED" as const;
export const MIF_QI_GAP_DETECTION_SKIPPED = "GAP_DETECTION_SKIPPED" as const;

/** Coverage codes */
export const MIF_QI_EMPTY_SERIES = "EMPTY_SERIES" as const;
export const MIF_QI_COVERAGE_BELOW_REQUIREMENT = "COVERAGE_BELOW_REQUIREMENT" as const;
export const MIF_QI_COVERAGE_MET = "COVERAGE_MET" as const;
export const MIF_QI_COVERAGE_OBSERVED_RANGE_ONLY = "COVERAGE_OBSERVED_RANGE_ONLY" as const;

export type MifQualityFindingCode =
  | typeof MIF_QI_INVALID_OHLC
  | typeof MIF_QI_INVALID_TIMESTAMP
  | typeof MIF_QI_INVALID_INTERVAL
  | typeof MIF_QI_PROVIDER_MISMATCH
  | typeof MIF_QI_SYMBOL_MISMATCH
  | typeof MIF_QI_TIMEFRAME_MISMATCH
  | typeof MIF_QI_DUPLICATE_OPEN
  | typeof MIF_QI_DUPLICATE_INTERVAL
  | typeof MIF_QI_CONFLICTING_CANDLE
  | typeof MIF_QI_OUT_OF_ORDER
  | typeof MIF_QI_OVERLAPPING_INTERVAL
  | typeof MIF_QI_UNEXPECTED_DURATION
  | typeof MIF_QI_UNSUPPORTED_CANDLE_STATE
  | typeof MIF_QI_MALFORMED_FIELD
  | typeof MIF_QI_CONFIRMED_MISSING
  | typeof MIF_QI_POSSIBLE_GAP
  | typeof MIF_QI_UNKNOWN_SESSION_GAP
  | typeof MIF_QI_INSUFFICIENT_HISTORY
  | typeof MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR
  | typeof MIF_QI_TIMEBASE_UNCERTAIN
  | typeof MIF_QI_TIMEBASE_MIXED
  | typeof MIF_QI_DURATION_UNSUPPORTED
  | typeof MIF_QI_GAP_DETECTION_SKIPPED
  | typeof MIF_QI_EMPTY_SERIES
  | typeof MIF_QI_COVERAGE_BELOW_REQUIREMENT
  | typeof MIF_QI_COVERAGE_MET
  | typeof MIF_QI_COVERAGE_OBSERVED_RANGE_ONLY;

/** Severity class for status derivation (not Phase 2 severity). */
export type MifQualityFindingSeverity = "blocking" | "degraded" | "warning" | "info";
