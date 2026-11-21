/**
 * Phase 2 — Unified Market Evidence Foundation contracts (HFM_MT5 only).
 * Analytical evidence packaging only. Does not approve AI reasoning or execution.
 */

export const MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID =
  "kwizera.mif.unified-market-evidence.v1" as const;
export const MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_UNIFIED_MARKET_EVIDENCE_ENGINE_ID =
  "mif-unified-market-evidence" as const;
export const MIF_UNIFIED_MARKET_EVIDENCE_ENGINE_VERSION = "1.0.0" as const;

export const MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID =
  "kwizera.mif.market-evidence-package.v1" as const;
export const MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_VERSION = "1.0.0" as const;

/** Soft payload bound for VPS-safe packages (Analyze Now consumers in later phases). */
export const MIF_MARKET_EVIDENCE_MAX_ITEMS = 120 as const;
export const MIF_MARKET_EVIDENCE_MAX_LEVELS = 40 as const;
export const MIF_MARKET_EVIDENCE_MAX_MEASUREMENTS = 40 as const;
export const MIF_MARKET_EVIDENCE_MAX_REFS = 40 as const;
export const MIF_MARKET_EVIDENCE_MAX_WARNINGS = 40 as const;
