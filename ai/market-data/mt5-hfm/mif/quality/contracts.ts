/**
 * Phase 5B.2 Step 1 — MIF quality contract identifiers (additive; HFM_MT5 only).
 * Separate from kwizera.mif.market-data.v1.
 */

export const MIF_QUALITY_CONTRACT_ID = "kwizera.mif.quality.v1" as const;
export const MIF_QUALITY_CONTRACT_VERSION = "1.0.0" as const;

/** Scoped Step 1 engine — data integrity, gaps, session uncertainty, coverage. */
export const MIF_QUALITY_STEP1_ENGINE_ID = "mif-quality-step1-integrity" as const;
export const MIF_QUALITY_STEP1_ENGINE_VERSION = "1.0.0" as const;

/** Default policy stamp for Step 1 (no universal missing-bar threshold). */
export const MIF_QUALITY_STEP1_POLICY_ID = "mif-quality-step1-hard-integrity" as const;
export const MIF_QUALITY_STEP1_POLICY_VERSION = "1.0.0" as const;

/** Step 2 engines — quote / instrument / multi-timeframe (additive). */
export const MIF_QUALITY_STEP2_QUOTE_ENGINE_ID = "mif-quality-step2-quote" as const;
export const MIF_QUALITY_STEP2_QUOTE_ENGINE_VERSION = "1.0.0" as const;
export const MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_ID = "mif-quality-step2-instrument" as const;
export const MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_VERSION = "1.0.0" as const;
export const MIF_QUALITY_STEP2_MTF_ENGINE_ID = "mif-quality-step2-multi-tf" as const;
export const MIF_QUALITY_STEP2_MTF_ENGINE_VERSION = "1.0.0" as const;

/** Named HFM analysis quote freshness profile (Phase 2 15s/180s semantics; not universal). */
export const MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS_ID = "hfm-analysis-quote" as const;
export const MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS_VERSION = "1.0.0" as const;
