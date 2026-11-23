/**
 * Phase 06 — Deep Technical & Multi-Timeframe Intelligence (HFM_MT5).
 *
 * Orchestrates existing MIF engines. Does not duplicate structure / S-R / Fib /
 * pattern / pressure math. Confluence grades are analytical labels — NOT
 * win probability and MUST NOT feed probability calibration.
 */
export const MIF_DEEP_TECHNICAL_CONTRACT_ID =
  "kwizera.mif.deep-technical-intelligence.v1" as const;
export const MIF_DEEP_TECHNICAL_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_DEEP_TECHNICAL_ENGINE_ID = "mif-deep-technical-intelligence" as const;
export const MIF_DEEP_TECHNICAL_ENGINE_VERSION = "1.0.0" as const;
export const MIF_DEEP_TECHNICAL_POLICY_ID = "mif-hfm-deep-technical-intelligence" as const;
export const MIF_DEEP_TECHNICAL_POLICY_VERSION = "1.0.0" as const;
export const MIF_DEEP_TECHNICAL_MODEL_VERSION = "phase06-orchestrator-v1" as const;

/** Minimum distinct usable timeframes for full MTF alignment claims. */
export const MIF_DTI_MIN_MTF_FRAMES = 2 as const;

/**
 * Confluence family weights (normalized at runtime).
 * Rationale: structure + MTF bias are primary; pressure is a correlated
 * candle-body proxy so weight is lower to reduce double-counting.
 */
export const MIF_DTI_WEIGHT_STRUCTURE = 0.22 as const;
export const MIF_DTI_WEIGHT_REGIME = 0.16 as const;
export const MIF_DTI_WEIGHT_MTF = 0.2 as const;
export const MIF_DTI_WEIGHT_LEVELS = 0.12 as const;
export const MIF_DTI_WEIGHT_PATTERNS = 0.1 as const;
export const MIF_DTI_WEIGHT_MOMENTUM = 0.1 as const;
export const MIF_DTI_WEIGHT_PRESSURE = 0.1 as const;

/** |directionalScore| ≥ this → STRONG confluence grade (not probability). */
export const MIF_DTI_CONFLUENCE_STRONG_MIN = 0.55 as const;
/** |directionalScore| ≥ this → MODERATE; else WEAK / NONE. */
export const MIF_DTI_CONFLUENCE_MODERATE_MIN = 0.28 as const;
