/**
 * Phase 2 — HFM Analysis preparation constants (analysis-only; no execution).
 */

export const HFM_ANALYSIS_PROVIDER = "HFM_MT5" as const;

/** Default Analysis timeframe pack (owner-approved). */
export const HFM_ANALYSIS_DEFAULT_TF_PACK = ["H1", "M30", "M15", "M5"] as const;

export type HfmAnalysisDefaultTf = (typeof HFM_ANALYSIS_DEFAULT_TF_PACK)[number];

/** Future Analysis candidates (Charts live-verified; not required in Phase 2 pack). */
export const HFM_ANALYSIS_FUTURE_TF_CANDIDATES = ["M1", "H4", "D1"] as const;

/** Candles fetched per timeframe for Analysis context (bounded for VPS/MT5). */
export const HFM_ANALYSIS_CANDLE_LIMIT = 120;

/** Candles displayed in each backend-rendered chart image. */
export const HFM_ANALYSIS_CHART_DISPLAY_CANDLES = 80;

export const HFM_ANALYSIS_IMAGE_WIDTH = 960;
export const HFM_ANALYSIS_IMAGE_HEIGHT = 540;
export const HFM_ANALYSIS_IMAGE_MAX_BYTES = 1_500_000;

export const HFM_ANALYSIS_RENDERER_VERSION = "hfm-analysis-png-v1";

/** Canonical hash version for snapshot identity. */
export const HFM_ANALYSIS_SNAPSHOT_HASH_VERSION = "hfm-analysis-snapshot-v1";

/** Retention (owner-approved). */
export const HFM_ANALYSIS_HISTORY_RETENTION_DAYS = 90;
export const HFM_ANALYSIS_IMAGE_RETENTION_DAYS = 7;

/**
 * Freshness policy derived from existing HFM feed policy + TF-aware candle tip allowance.
 * Quote LIVE/STALE windows match DEFAULT_MT5_HFM_FRESHNESS_POLICY.
 */
export const HFM_ANALYSIS_QUALITY_POLICY = {
  quoteLiveMaxAgeSec: 15,
  quoteStaleMaxAgeSec: 180,
  /** Extra allowance on forming tip age relative to timeframe seconds before STALE. */
  candleTipGraceTfMultipliers: {
    M5: 2,
    M15: 2,
    M30: 2,
    H1: 2,
  } as Record<string, number>,
  minCandlesPerTf: 30,
  maxMissingBarRatio: 0.15,
  spreadEpsilon: 1e-10,
} as const;

export const TF_SECONDS: Record<string, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
};
