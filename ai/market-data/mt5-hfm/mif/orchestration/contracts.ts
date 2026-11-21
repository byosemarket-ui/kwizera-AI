/**
 * Phase 3 — HFM Data Synchronization & Intelligence Orchestration contracts.
 * Analytical only. Does not approve AI reasoning or broker execution.
 */

export const MIF_ORCHESTRATION_CONTRACT_ID =
  "kwizera.mif.intelligence-orchestration.v1" as const;
export const MIF_ORCHESTRATION_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_ORCHESTRATION_ENGINE_ID = "mif-hfm-intelligence-orchestration" as const;
export const MIF_ORCHESTRATION_ENGINE_VERSION = "1.0.0" as const;

/** Approved synchronized Analyze Now intelligence pack. */
export const MIF_ORCHESTRATION_TF_PACK = ["H4", "H1", "M30", "M15", "M5"] as const;

/** Hard wall-clock budget for ordinary Analyze Now orchestration (ms). */
export const MIF_ORCHESTRATION_DEADLINE_MS = 10_000 as const;

export const MIF_ORCHESTRATION_PRIMARY_TIMEFRAME = "H1" as const;
