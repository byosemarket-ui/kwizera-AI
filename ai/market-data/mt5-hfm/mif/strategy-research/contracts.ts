/**
 * Phase 08 — Historical Research & Strategy Intelligence contracts (HFM_MT5).
 * Research/analytical only. Not execution. Not calibrated probability.
 */
export const MIF_STRATEGY_RESEARCH_CONTRACT_ID =
  "kwizera.mif.strategy-research.v1" as const;
export const MIF_STRATEGY_RESEARCH_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_STRATEGY_RESEARCH_ENGINE_ID = "mif-strategy-research" as const;
export const MIF_STRATEGY_RESEARCH_ENGINE_VERSION = "1.0.0" as const;
export const MIF_STRATEGY_RESEARCH_MODEL_VERSION = "phase08-research-v1" as const;
export const MIF_STRATEGY_RESEARCH_POLICY_ID =
  "mif-hfm-strategy-research" as const;
export const MIF_STRATEGY_RESEARCH_POLICY_VERSION = "1.0.0" as const;

/** Minimum closed trades before win-rate is labeled AVAILABLE (still RESEARCH_ONLY). */
export const MIF_STRATEGY_RESEARCH_MIN_SAMPLE = 30 as const;

/** Hard bounds for cost-sensitivity grids (VPS safety). */
export const MIF_STRATEGY_RESEARCH_MAX_COST_SCENARIOS = 12 as const;
export const MIF_STRATEGY_RESEARCH_MAX_EVENT_WINDOWS = 8 as const;
export const MIF_STRATEGY_RESEARCH_MAX_REGIME_BUCKETS = 16 as const;
