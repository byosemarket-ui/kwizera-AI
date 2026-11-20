/**
 * Phase 5F STEP 1 — Historical Research Foundation contracts.
 * Read-only HFM_MT5 research archive. No execution. No auto-worker.
 */

export const MIF_HISTORICAL_RESEARCH_CONTRACT_ID =
  "kwizera.mif.historical-research.v1" as const;
export const MIF_HISTORICAL_RESEARCH_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_HISTORICAL_RESEARCH_ENGINE_ID =
  "mif-historical-research-foundation" as const;
export const MIF_HISTORICAL_RESEARCH_ENGINE_VERSION = "1.0.0" as const;

export const MIF_RESEARCH_PROVIDER_ID = "HFM_MT5" as const;

/** Hard page size — must match historical-engine / MaxOnDemandBars. */
export const MIF_RESEARCH_MAX_BARS_PER_PAGE = 300 as const;
export const MIF_RESEARCH_MAX_START_POS = 50000 as const;
/** Default serial page budget (VPS-safe). */
export const MIF_RESEARCH_DEFAULT_MAX_PAGES = 20 as const;
/** Absolute bar ceiling per export job. */
export const MIF_RESEARCH_HARD_MAX_BARS = 10000 as const;
/** Bounded bar page responses for API. */
export const MIF_RESEARCH_API_MAX_BAR_PAGE = 500 as const;

/**
 * Trading-cost availability classifications.
 * Never invent costs; never treat current metadata as historical truth.
 */
export const MIF_RESEARCH_COST_AVAILABILITY = [
  "SOURCE_BACKED",
  "CURRENT_METADATA_ONLY",
  "UNAVAILABLE",
] as const;
export type MifResearchCostAvailability =
  (typeof MIF_RESEARCH_COST_AVAILABILITY)[number];

export const MIF_RESEARCH_DATASET_STATUS = [
  "COMPLETE",
  "INCOMPLETE",
] as const;
export type MifResearchDatasetStatus =
  (typeof MIF_RESEARCH_DATASET_STATUS)[number];

export const MIF_RESEARCH_EXPORT_JOB_STATUS = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "INCOMPLETE",
  "FAILED",
] as const;
export type MifResearchExportJobStatus =
  (typeof MIF_RESEARCH_EXPORT_JOB_STATUS)[number];

/**
 * Env gate for explicit export execution.
 * Default OFF — export only when KWIZERA_MIF_RESEARCH_EXPORT_ENABLED=1
 * and an admin/API/caller explicitly invokes the exporter.
 * Never enables a background worker.
 */
export function isResearchExportExplicitlyEnabled(): boolean {
  return String(process.env.KWIZERA_MIF_RESEARCH_EXPORT_ENABLED ?? "").trim() === "1";
}
