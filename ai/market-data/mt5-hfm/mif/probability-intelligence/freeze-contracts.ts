/**
 * Phase 5F STEP 5 Phase B — immutable prediction-time probability freeze contracts.
 * Analytical only. Freeze ≠ calibrated probability. Never reconstruct from outcomes.
 */
export const MIF_PROBABILITY_FREEZE_CONTRACT_ID =
  "kwizera.mif.probability-freeze.v1" as const;
export const MIF_PROBABILITY_FREEZE_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_PROBABILITY_FREEZE_ENGINE_ID = "mif-probability-freeze" as const;
export const MIF_PROBABILITY_FREEZE_ENGINE_VERSION = "1.0.0" as const;

/** Unit interval [0,1] only. */
export const MIF_PROBABILITY_FREEZE_SCALE = "UNIT_INTERVAL" as const;

export const MIF_PROBABILITY_FREEZE_MAX_API_LIST = 100 as const;
export const MIF_PROBABILITY_FREEZE_DEFAULT_API_LIST = 50 as const;
