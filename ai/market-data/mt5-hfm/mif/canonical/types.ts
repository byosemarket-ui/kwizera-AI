/**
 * Phase 5B.1 — MIF canonical market-data contract identifiers (HFM_MT5 only).
 * Additive foundation; does not replace Phase 2 analysis types.
 */

export const MIF_MARKET_DATA_CONTRACT_ID = "kwizera.mif.market-data.v1" as const;
export const MIF_MARKET_DATA_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_PROVIDER_ID = "HFM_MT5" as const;
export type MifProviderId = typeof MIF_PROVIDER_ID;

/**
 * Volume classification (descriptive — always also inspect tickVolume/realVolume).
 * - tick: only tickVolume present
 * - real: only realVolume present
 * - tick_and_real: both present (neither field is absent)
 * - none: both null
 * - unknown_collapsed: single ambiguous volume payload (e.g. UnifiedCandle.volume)
 */
export type MifVolumeType =
  | "tick"
  | "real"
  | "tick_and_real"
  | "none"
  | "unknown_collapsed";

export type MifCandleState = "CLOSED" | "FORMING" | "STALE" | "MISSING" | "INVALID";

export type MifTimebase = "BROKER_SERVER" | "UTC" | "UNKNOWN";

export type MifPriceBasis = "bid" | "ask" | "mid" | "last" | "unspecified" | "unknown";

export type MifSourceDialect =
  | "hfm.historical-bar"
  | "hfm.forming-candle"
  | "unified.candle"
  | "hfm.canonical-quote"
  | "hfm.catalog-instrument";

export type MifAvailabilityStatus = "KNOWN" | "UNKNOWN";

export interface MifValidationMeta {
  status: "ok" | "rejected" | "partial" | "unavailable" | "unknown";
  errors: string[];
  warnings: string[];
}

/**
 * Descriptive contract metadata only — NOT a security enforcement boundary.
 * Actual execution safety is enforced by existing authorization, execution-master,
 * emergency locks, and broker modules. These fields must remain false on MIF payloads
 * and must never be treated as the sole control that prevents orders.
 */
export interface MifSafetyFlags {
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}
