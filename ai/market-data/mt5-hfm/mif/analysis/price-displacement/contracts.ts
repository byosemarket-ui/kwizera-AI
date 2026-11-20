/**
 * Phase 5D.7 — Price Displacement Assessment contracts.
 *
 * Dedicated engine — does NOT derive displacement solely from market-regime labels.
 * Analytical only: no institutional-order-flow claims from OHLC alone.
 */
export const MIF_PRICE_DISPLACEMENT_CONTRACT_ID =
  "kwizera.mif.price-displacement.v1" as const;
export const MIF_PRICE_DISPLACEMENT_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_PRICE_DISPLACEMENT_ENGINE_ID = "mif-price-displacement" as const;
export const MIF_PRICE_DISPLACEMENT_ENGINE_VERSION = "1.0.0" as const;
export const MIF_PRICE_DISPLACEMENT_POLICY_ID = "mif-hfm-price-displacement" as const;
export const MIF_PRICE_DISPLACEMENT_POLICY_VERSION = "1.0.0" as const;
/** Same ATR method as regime/patterns: SMA of True Range. */
export const MIF_PRICE_DISPLACEMENT_ATR_METHOD_ID = "SMA_OF_TR" as const;

/**
 * Default thresholds (rationale documented on policy object).
 * Tunable via AssessMifPriceDisplacementInput.policy overrides — not invented per-call.
 */
export const MIF_PRICE_DISPLACEMENT_ATR_PERIOD = 14 as const;
/** Need ATR warm-up + tip candle. */
export const MIF_PRICE_DISPLACEMENT_MIN_CLOSED = 16 as const;
/**
 * Body / ATR — candle magnitude gate.
 * Rationale: body ≥ 1.0 ATR is a strong impulse candle relative to recent volatility
 * (aligned with common ATR-normalized impulse filters; not a win probability).
 */
export const MIF_PRICE_DISPLACEMENT_MIN_BODY_ATR = 1.0 as const;
/**
 * True range / ATR — range-expansion gate.
 * Rationale: TR ≥ 1.2 ATR distinguishes expansion from ordinary noise around ATR≈1.
 */
export const MIF_PRICE_DISPLACEMENT_MIN_TR_ATR = 1.2 as const;
/**
 * Close location within [low, high] in [0,1].
 * Bullish: close near high (≥ 0.65). Bearish: close near low (≤ 0.35).
 * Rationale: rejects dojis / mid-range closes that lack directional follow-through
 * even when the range is large.
 */
export const MIF_PRICE_DISPLACEMENT_MIN_CLOSE_LOCATION = 0.65 as const;
/**
 * Structural break buffer in ATR units beyond a validated boundary.
 * Rationale: avoids tick-noise "breaks"; 0.05 ATR is a thin confirmation buffer.
 */
export const MIF_PRICE_DISPLACEMENT_STRUCTURAL_BUFFER_ATR = 0.05 as const;
