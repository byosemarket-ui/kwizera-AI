/**
 * Phase 09 — Live Data Validation & Research Reliability contracts (HFM_MT5).
 * Reliability/analytical only. Not probability. Not execution.
 */
export const MIF_RESEARCH_RELIABILITY_CONTRACT_ID =
  "kwizera.mif.research-reliability.v1" as const;
export const MIF_RESEARCH_RELIABILITY_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_RESEARCH_RELIABILITY_ENGINE_ID = "mif-research-reliability" as const;
export const MIF_RESEARCH_RELIABILITY_ENGINE_VERSION = "1.0.0" as const;
export const MIF_RESEARCH_RELIABILITY_MODEL_VERSION = "phase09-reliability-v1" as const;
export const MIF_RESEARCH_RELIABILITY_POLICY_ID =
  "mif-hfm-research-reliability" as const;
export const MIF_RESEARCH_RELIABILITY_POLICY_VERSION = "1.0.0" as const;

/** Default quote freshness (sec) — aligned with HFM demo acquisition windows; documented in policy. */
export const MIF_RR_QUOTE_LIVE_MAX_AGE_SEC = 15 as const;
export const MIF_RR_QUOTE_STALE_MAX_AGE_SEC = 120 as const;

/** Relative mid-price discontinuity threshold (fraction). Configurable via policy. */
export const MIF_RR_PRICE_DISCONTINUITY_FRAC = 0.02 as const;

/** Spread wide vs median recent observations (multiplier). */
export const MIF_RR_SPREAD_WIDE_MULTIPLIER = 3 as const;

/** Minimum closed trades before degradation can be CONFIRMED. */
export const MIF_RR_MIN_SAMPLE_DEGRADATION = 30 as const;

/** Expectancy drop fraction vs baseline to SUSPECT degradation. */
export const MIF_RR_DEGRADATION_SUSPECT_FRAC = 0.35 as const;

/** Expectancy drop fraction + sample to CONFIRM degradation. */
export const MIF_RR_DEGRADATION_CONFIRM_FRAC = 0.5 as const;

export const MIF_RR_MAX_ALERTS = 32 as const;
export const MIF_RR_MAX_COMPARE_BARS = 120 as const;
