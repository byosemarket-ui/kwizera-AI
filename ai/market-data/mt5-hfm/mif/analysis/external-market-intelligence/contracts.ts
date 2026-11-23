/**
 * Phase 07 — External Market & Fundamental Intelligence (HFM_MT5).
 *
 * Orchestrates existing HFM fundamentals calendar cache + optional technical
 * context. Does NOT create a second calendar provider or enable background
 * refresh. News / central-bank live feeds are UNAVAILABLE unless separately
 * authorized. Scores are NOT win probability.
 */
export const MIF_EXTERNAL_MARKET_CONTRACT_ID =
  "kwizera.mif.external-market-intelligence.v1" as const;
export const MIF_EXTERNAL_MARKET_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_EXTERNAL_MARKET_ENGINE_ID = "mif-external-market-intelligence" as const;
export const MIF_EXTERNAL_MARKET_ENGINE_VERSION = "1.0.0" as const;
export const MIF_EXTERNAL_MARKET_POLICY_ID = "mif-hfm-external-market-intelligence" as const;
export const MIF_EXTERNAL_MARKET_POLICY_VERSION = "1.0.0" as const;
export const MIF_EXTERNAL_MARKET_MODEL_VERSION = "phase07-orchestrator-v1" as const;

/** High-impact event within this many ms → HIGH_EVENT_RISK (when scheduled/upcoming). */
export const MIF_EMI_HIGH_RISK_WINDOW_MS = 2 * 60 * 60 * 1000 as const;
/** Medium-impact or high-impact within this window → ELEVATED. */
export const MIF_EMI_ELEVATED_RISK_WINDOW_MS = 24 * 60 * 60 * 1000 as const;
/** High-impact within this window → MODERATE if not already elevated. */
export const MIF_EMI_MODERATE_RISK_WINDOW_MS = 72 * 60 * 60 * 1000 as const;

export const MIF_EMI_PROVIDER_SHOWMYTRADES = "SHOWMYTRADES" as const;
export const MIF_EMI_CALENDAR_SOURCE = "HFM_FUNDAMENTALS_CACHE" as const;
