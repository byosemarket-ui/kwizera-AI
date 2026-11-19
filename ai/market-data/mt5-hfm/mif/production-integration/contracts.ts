/**
 * Phase 5D.5 — HFM_MT5 → MIF → Opportunity Detection production integration contracts.
 * Analytical / read-only only. Does not approve AI reasoning or execution.
 */

export const MIF_PRODUCTION_INTEGRATION_CONTRACT_ID =
  "kwizera.mif.production-integration.v1" as const;
export const MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_PRODUCTION_INTEGRATION_ENGINE_ID =
  "mif-hfm-opportunity-production-pipeline" as const;
export const MIF_PRODUCTION_INTEGRATION_ENGINE_VERSION = "1.0.0" as const;

/** Default TF pack covering MTF required H4/H1/M15 plus intermediate/setup. */
export const MIF_PRODUCTION_DEFAULT_TIMEFRAMES = [
  "H4",
  "H1",
  "M30",
  "M15",
  "M5",
] as const;

/** Primary TF for single-series assessments attached to OD context. */
export const MIF_PRODUCTION_PRIMARY_TIMEFRAME = "H1" as const;

/** Bounded candle limit for VPS-safe retrieval. */
export const MIF_PRODUCTION_CANDLE_LIMIT = 120 as const;
