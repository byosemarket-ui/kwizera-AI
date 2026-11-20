/**
 * Phase 5F STEP 2 — Historical Analogue & Market Similarity contracts.
 * Analytical research only. Similarity ≠ probability. No execution.
 */

export const MIF_ANALOGUE_CONTRACT_ID = "kwizera.mif.historical-analogue.v1" as const;
export const MIF_ANALOGUE_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_ANALOGUE_ENGINE_ID = "mif-historical-analogue-engine" as const;
export const MIF_ANALOGUE_ENGINE_VERSION = "1.0.0" as const;

export const MIF_ANALOGUE_FEATURE_SET_ID = "analogue-features-price-action" as const;
export const MIF_ANALOGUE_FEATURE_SET_VERSION = "1.0.0" as const;

export const MIF_ANALOGUE_NORMALIZATION_POLICY_ID = "analogue-norm-atr-zscore" as const;
export const MIF_ANALOGUE_NORMALIZATION_POLICY_VERSION = "1.0.0" as const;

export const MIF_ANALOGUE_WEIGHT_TABLE_ID = "analogue-weights-v1" as const;
export const MIF_ANALOGUE_WEIGHT_TABLE_VERSION = "1.0.0" as const;

export const MIF_ANALOGUE_SIMILARITY_ALGORITHM_ID = "weighted-euclidean-cosine-jaccard" as const;
export const MIF_ANALOGUE_SIMILARITY_ALGORITHM_VERSION = "1.0.0" as const;

export const MIF_ANALOGUE_OVERLAP_POLICY_ID = "analogue-overlap-iou" as const;
export const MIF_ANALOGUE_OVERLAP_POLICY_VERSION = "1.0.0" as const;

export const MIF_ANALOGUE_ELIGIBILITY_MODES = [
  "PRICE_ACTION",
  "STRUCTURE_REGIME",
  "MULTI_TIMEFRAME",
  "HISTORICAL_OUTCOME",
] as const;
export type MifAnalogueEligibilityMode = (typeof MIF_ANALOGUE_ELIGIBILITY_MODES)[number];

/** Default lookback / warmup (CLOSED bars). */
export const MIF_ANALOGUE_DEFAULT_LOOKBACK_BARS = 32 as const;
export const MIF_ANALOGUE_DEFAULT_WARMUP_BARS = 40 as const;
export const MIF_ANALOGUE_MIN_LOOKBACK_BARS = 8 as const;
export const MIF_ANALOGUE_MAX_LOOKBACK_BARS = 128 as const;

/** VPS-safe search bounds. */
export const MIF_ANALOGUE_DEFAULT_MAX_DATASETS = 54 as const;
export const MIF_ANALOGUE_DEFAULT_MAX_CANDIDATES_SCANNED = 5000 as const;
export const MIF_ANALOGUE_DEFAULT_MAX_RESULTS = 25 as const;
export const MIF_ANALOGUE_HARD_MAX_RESULTS = 100 as const;
export const MIF_ANALOGUE_DEFAULT_STRIDE = 1 as const;
export const MIF_ANALOGUE_DEFAULT_TIMEOUT_MS = 15_000 as const;
export const MIF_ANALOGUE_DEFAULT_MIN_FEATURE_COVERAGE = 0.7 as const;
export const MIF_ANALOGUE_DEFAULT_OVERLAP_IOU = 0.5 as const;

/** Outcome horizons in bars after tip (exclusive). */
export const MIF_ANALOGUE_DEFAULT_OUTCOME_HORIZONS = [4, 8, 16] as const;

/** Similarity score is mapped to [0, 100]. */
export const MIF_ANALOGUE_SCORE_MIN = 0 as const;
export const MIF_ANALOGUE_SCORE_MAX = 100 as const;

export const MIF_ANALOGUE_COMPARISON_MODES = [
  "SAME_INSTRUMENT_SAME_TIMEFRAME",
  "CROSS_INSTRUMENT_SAME_TIMEFRAME",
  "SAME_INSTRUMENT_CROSS_TIMEFRAME",
  "CROSS_INSTRUMENT_CROSS_TIMEFRAME",
] as const;
export type MifAnalogueComparisonMode = (typeof MIF_ANALOGUE_COMPARISON_MODES)[number];
