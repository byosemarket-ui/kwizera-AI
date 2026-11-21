/**
 * Phase 5F STEP 5 Phase C — walk-forward-aware calibration contracts.
 * Metrics-only evaluation by default. Not broker execution. Not mid-split 5E.
 */
export const MIF_WF_CALIBRATION_CONTRACT_ID =
  "kwizera.mif.wf-calibration.v1" as const;
export const MIF_WF_CALIBRATION_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_WF_CALIBRATION_ENGINE_ID = "mif-wf-calibration-engine" as const;
export const MIF_WF_CALIBRATION_ENGINE_VERSION = "1.0.0" as const;
export const MIF_WF_CALIBRATION_BINNING_POLICY_ID =
  "wf-calibration-equal-count-bins" as const;
export const MIF_WF_CALIBRATION_BINNING_POLICY_VERSION = "1.0.0" as const;

/** Log-loss probability clip (documented). */
export const MIF_WF_CALIBRATION_LOGLOSS_EPS = 1e-15 as const;

export const MIF_WF_CALIBRATION_DEFAULT_BIN_COUNT = 5 as const;
/** MCE only when each reliability bin has at least this many samples. */
export const MIF_WF_CALIBRATION_MCE_MIN_BIN_COUNT = 5 as const;
export const MIF_WF_CALIBRATION_MCE_MIN_TOTAL = 50 as const;

export const MIF_WF_CALIBRATION_PROVISIONAL_THRESHOLD = 30 as const;
export const MIF_WF_CALIBRATION_CALIBRATED_THRESHOLD = 100 as const;

export const MIF_WF_CALIBRATION_TARGET_EVENT =
  "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON" as const;

export const MIF_WF_CALIBRATION_MAX_RUNS_LIST = 50 as const;
export const MIF_WF_CALIBRATION_MAX_EVIDENCE = 500 as const;
