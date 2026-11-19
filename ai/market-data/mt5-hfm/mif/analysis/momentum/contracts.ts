/** Phase 5D.6 — Momentum Assessment contracts. */
export const MIF_MOMENTUM_CONTRACT_ID = "kwizera.mif.momentum.v1" as const;
export const MIF_MOMENTUM_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_MOMENTUM_ENGINE_ID = "mif-momentum" as const;
export const MIF_MOMENTUM_ENGINE_VERSION = "1.0.0" as const;
export const MIF_MOMENTUM_POLICY_ID = "mif-hfm-momentum" as const;
export const MIF_MOMENTUM_POLICY_VERSION = "1.0.0" as const;

/** ROC lookback in closed bars. */
export const MIF_MOMENTUM_ROC_PERIOD = 14 as const;
/** Wilder RSI period. */
export const MIF_MOMENTUM_RSI_PERIOD = 14 as const;
/** Minimum closed candles = max(ROC,RSI) + 1 warm-up. */
export const MIF_MOMENTUM_MIN_CLOSED = 30 as const;
