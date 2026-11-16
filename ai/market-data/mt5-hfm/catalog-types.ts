/**
 * HFM MT5 instrument catalog contracts (Phase 1).
 * Provider identity is always HFM_MT5. No live bid/ask persistence.
 */

export const HFM_CATALOG_PROVIDER = "HFM_MT5" as const;
export const HFM_CATALOG_ENVIRONMENT = "demo" as const;

export const HFM_CATALOG_CATEGORIES = [
  "FOREX",
  "METALS",
  "INDICES",
  "ENERGIES",
  "SHARES",
  "COMMODITIES",
  "OTHER",
  "UNCLASSIFIED",
] as const;
export type HfmCatalogCategory = (typeof HFM_CATALOG_CATEGORIES)[number];

export const HFM_CATALOG_LIFECYCLES = [
  "ACTIVE",
  "NOT_CURRENTLY_AVAILABLE",
  "METADATA_INCOMPLETE",
  "REMOVED_OR_UNAVAILABLE",
  "CUSTOM",
  "UNCLASSIFIED",
] as const;
export type HfmCatalogLifecycle = (typeof HFM_CATALOG_LIFECYCLES)[number];

export const HFM_DISCOVERY_STATUSES = [
  "IDLE",
  "IN_PROGRESS",
  "COMPLETE",
  "FAILED",
  "UNAVAILABLE",
  "STALE",
  "LAST_KNOWN",
] as const;
export type HfmDiscoveryStatus = (typeof HFM_DISCOVERY_STATUSES)[number];

export type HfmClassificationMethod =
  | "SYMBOL_PATH"
  | "SECTOR"
  | "INDUSTRY"
  | "CATEGORY_RAW"
  | "TRADE_CALC_MODE"
  | "CONTRACT"
  | "DESCRIPTION"
  | "NAME_HEURISTIC"
  | "UNCLASSIFIED";

export type HfmClassificationConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface HfmClassificationResult {
  category: HfmCatalogCategory;
  method: HfmClassificationMethod;
  confidence: HfmClassificationConfidence;
  evidence: string[];
  classifiedAt: string;
  classifierVersion?: string;
}

export interface HfmSessionDaySummary {
  tradeFrom: number | null;
  tradeTo: number | null;
  quoteFrom: number | null;
  quoteTo: number | null;
}

export interface HfmSessionSummary {
  tradeSessionDays: number;
  quoteSessionDays: number;
  days?: Record<string, HfmSessionDaySummary>;
}

/** Raw symbol row as emitted by MQL NDJSON (before Node enrichment). */
export interface HfmRawCatalogSymbol {
  symbol: string;
  symbolExists: boolean | null;
  customSymbol: boolean | null;
  description: string | null;
  path: string | null;
  isin: string | null;
  categoryRaw: string | null;
  sector: number | null;
  industry: number | null;
  sectorName: string | null;
  industryName: string | null;
  selected: boolean | null;
  visible: boolean | null;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
  tickValue: number | null;
  tickValueProfit: number | null;
  tickValueLoss: number | null;
  contractSize: number | null;
  volumeMin: number | null;
  volumeMax: number | null;
  volumeStep: number | null;
  volumeLimit: number | null;
  tradeCalcMode: number | null;
  tradeMode: number | null;
  orderMode: number | null;
  executionMode: number | null;
  fillingMode: number | null;
  expirationMode: number | null;
  stopsLevel: number | null;
  freezeLevel: number | null;
  marginInitial: number | null;
  marginMaintenance: number | null;
  currencyBase: string | null;
  currencyProfit: string | null;
  currencyMargin: string | null;
  synchronized: boolean | null;
  sessions: HfmSessionSummary | null;
  fieldErrors: Record<string, string>;
}

export interface HfmCatalogInstrument extends HfmRawCatalogSymbol {
  provider: typeof HFM_CATALOG_PROVIDER;
  environment: typeof HFM_CATALOG_ENVIRONMENT;
  brokerServer: string | null;
  catalogVersion: string;
  lifecycle: HfmCatalogLifecycle;
  firstDiscoveredAt: string;
  lastDiscoveredAt: string;
  metadataCompleteness: number;
  classification: HfmClassificationResult;
}

export interface HfmCatalogChangeSummary {
  added: string[];
  removed: string[];
  descriptionChanged: string[];
  specificationChanged: string[];
  classificationChanged: string[];
  metadataErrorsChanged: string[];
}

export interface HfmCatalogSnapshot {
  provider: typeof HFM_CATALOG_PROVIDER;
  environment: typeof HFM_CATALOG_ENVIRONMENT;
  brokerServer: string | null;
  catalogVersion: string;
  checksumSha256: string;
  discoveryStatus: HfmDiscoveryStatus;
  freshness: "COMPLETE" | "PARTIAL" | "STALE" | "UNAVAILABLE" | "LAST_KNOWN" | "IN_PROGRESS";
  enumerationStartedAt: string | null;
  enumerationCompletedAt: string | null;
  ingestedAt: string;
  generalSymbolCount: number | null;
  selectedSymbolCount: number | null;
  enumeratedCount: number;
  validCount: number;
  duplicateCount: number | null;
  customCount: number | null;
  metadataCompletenessAvg: number;
  fieldErrorSummary: Record<string, number>;
  categoryCounts: Record<HfmCatalogCategory, number>;
  changes: HfmCatalogChangeSummary | null;
  symbols: HfmCatalogInstrument[];
  source: "mql5_catalog";
  schemaVersion: 1;
  classifierVersion?: string;
  mutatesBroker: false;
  placesOrders: false;
  acceptsForExecution: false;
}

export interface HfmCatalogStatusView {
  provider: typeof HFM_CATALOG_PROVIDER;
  environment: typeof HFM_CATALOG_ENVIRONMENT;
  available: boolean;
  artifactReady: boolean;
  discoveryStatus: HfmDiscoveryStatus | string;
  freshness: HfmCatalogSnapshot["freshness"];
  brokerServer: string | null;
  catalogVersion: string | null;
  checksumSha256: string | null;
  enumerationStartedAt: string | null;
  enumerationCompletedAt: string | null;
  ingestedAt: string | null;
  lastSuccessfulDiscoveryAt: string | null;
  lastFailedDiscoveryAt: string | null;
  lastFailedReason: string | null;
  generalSymbolCount: number | null;
  selectedSymbolCount: number | null;
  enumeratedCount: number | null;
  validCount: number | null;
  duplicateCount: number | null;
  customCount: number | null;
  metadataCompletenessAvg: number | null;
  fieldErrorSummary: Record<string, number>;
  categoryCounts: Partial<Record<HfmCatalogCategory, number>>;
  changes: HfmCatalogChangeSummary | null;
  source: "mql5_catalog" | "persisted" | "none";
  unavailableReason: string | null;
  mutatesBroker: false;
  placesOrders: false;
  acceptsForExecution: false;
}

export const HFM_CATALOG_SPEC_KEYS = [
  "digits",
  "point",
  "tickSize",
  "tickValue",
  "contractSize",
  "volumeMin",
  "volumeMax",
  "volumeStep",
  "tradeCalcMode",
  "tradeMode",
  "executionMode",
] as const;
