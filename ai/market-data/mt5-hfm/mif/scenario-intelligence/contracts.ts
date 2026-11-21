/**
 * Phase 4 — deterministic Scenario Intelligence contracts.
 * Analytical only. Non-LLM. Does not approve AI reasoning or broker execution.
 */

export const MIF_SCENARIO_INTELLIGENCE_CONTRACT_ID =
  "kwizera.mif.scenario-intelligence.v1" as const;
export const MIF_SCENARIO_INTELLIGENCE_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_SCENARIO_INTELLIGENCE_ENGINE_ID =
  "mif-hfm-scenario-intelligence" as const;
export const MIF_SCENARIO_INTELLIGENCE_ENGINE_VERSION = "1.0.0" as const;

export const MIF_SCENARIO_PACKAGE_CONTRACT_ID =
  "kwizera.mif.scenario-package.v1" as const;
export const MIF_SCENARIO_PACKAGE_CONTRACT_VERSION = "1.0.0" as const;

/** Approved Analyze Now timeframe roles (Phase 3 pack). */
export const MIF_SCENARIO_TF_PACK = ["H4", "H1", "M30", "M15", "M5"] as const;
