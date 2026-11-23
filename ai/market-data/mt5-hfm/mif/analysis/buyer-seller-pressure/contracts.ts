/**
 * Phase 05 — Buyer/Seller Pressure & Dominance Intelligence (HFM_MT5).
 *
 * Candle-structure + tick-activity PROXY model.
 * Does NOT claim true aggressor-side order flow, depth, or institutional absorption.
 * Pressure scores are NOT win probability and MUST NOT feed probability calibration.
 */
export const MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID =
  "kwizera.mif.buyer-seller-pressure.v1" as const;
export const MIF_BUYER_SELLER_PRESSURE_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_BUYER_SELLER_PRESSURE_ENGINE_ID = "mif-buyer-seller-pressure" as const;
export const MIF_BUYER_SELLER_PRESSURE_ENGINE_VERSION = "1.0.0" as const;
export const MIF_BUYER_SELLER_PRESSURE_POLICY_ID = "mif-hfm-buyer-seller-pressure" as const;
export const MIF_BUYER_SELLER_PRESSURE_POLICY_VERSION = "1.0.0" as const;
export const MIF_BUYER_SELLER_PRESSURE_MODEL_VERSION = "phase05-candle-proxy-v1" as const;

/** Closed candles required for tip assessment (ATR warm-up + tip). */
export const MIF_BSP_MIN_CLOSED = 16 as const;
export const MIF_BSP_ATR_PERIOD = 14 as const;
/** Lookback for persistence / trend of imbalance (closed bars including tip). */
export const MIF_BSP_PERSISTENCE_BARS = 5 as const;
/**
 * |imbalance| ≥ this → nominate a dominant side (0–1 scale).
 * Rationale: below ~0.15 is noise relative to CLV/body composition; not a probability.
 */
export const MIF_BSP_IMBALANCE_DOMINANCE_MIN = 0.15 as const;
/**
 * |imbalance| ≥ this → strong dominance (vs weak).
 * Rationale: ~0.35 requires clear close-location + body agreement across persistence.
 */
export const MIF_BSP_IMBALANCE_STRONG_MIN = 0.35 as const;
/**
 * Same-side tip agreement across persistence window for SUSTAINED (vs SPIKE).
 * Rationale: ≥3 of last 5 bars agree → not a single-candle artifact.
 */
export const MIF_BSP_SUSTAINED_AGREE_MIN = 3 as const;
/**
 * Absorption proxy: price progress (ATR-normalized |close-open|) below this
 * while relative tick activity is elevated.
 */
export const MIF_BSP_ABSORPTION_MAX_BODY_ATR = 0.35 as const;
export const MIF_BSP_ABSORPTION_MIN_TICK_RATIO = 1.4 as const;
