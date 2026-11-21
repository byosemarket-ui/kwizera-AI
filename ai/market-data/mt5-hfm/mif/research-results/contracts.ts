/**
 * Phase 5F STEP 5 Phase B — Research Results foundation contracts.
 * Descriptive aggregation only. Not calibrated probability. Not executable.
 */
export const MIF_RESEARCH_RESULTS_CONTRACT_ID =
  "kwizera.mif.research-results.v1" as const;
export const MIF_RESEARCH_RESULTS_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_RESEARCH_RESULTS_ENGINE_ID = "mif-research-results" as const;
export const MIF_RESEARCH_RESULTS_ENGINE_VERSION = "1.0.0" as const;

export const MIF_RESEARCH_RESULTS_MAX_DATASETS = 200 as const;
export const MIF_RESEARCH_RESULTS_MAX_SEARCHES = 50 as const;
export const MIF_RESEARCH_RESULTS_MAX_OUTCOMES = 100 as const;
export const MIF_RESEARCH_RESULTS_MAX_ASSESSMENTS = 100 as const;
export const MIF_RESEARCH_RESULTS_MAX_FREEZES = 100 as const;
export const MIF_RESEARCH_RESULTS_MAX_BACKTESTS = 20 as const;
export const MIF_RESEARCH_RESULTS_MAX_CALIBRATION_RUNS = 20 as const;
export const MIF_RESEARCH_RESULTS_MAX_API_LIST = 50 as const;

/** Display / claim labels — never imply calibrated probability. */
export const MIF_RESEARCH_LABEL_DESCRIPTIVE = "DESCRIPTIVE — NOT A PROBABILITY" as const;
export const MIF_RESEARCH_LABEL_UNCALIBRATED = "UNCALIBRATED" as const;
export const MIF_RESEARCH_LABEL_INSUFFICIENT = "INSUFFICIENT DATA" as const;
export const MIF_RESEARCH_LABEL_COST_UNAVAILABLE =
  "COST-ADJUSTED BACKTEST NOT AVAILABLE" as const;
export const MIF_RESEARCH_LABEL_NOT_CALIBRATED = "NOT_CALIBRATED" as const;

/** Binary decisive event for future calibration (denominator excludes non-decisive). */
export const MIF_RESEARCH_DECISIVE_TARGET_EVENT =
  "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON" as const;

export const MIF_RESEARCH_PROVISIONAL_THRESHOLD = 30 as const;
export const MIF_RESEARCH_CALIBRATED_THRESHOLD = 100 as const;
