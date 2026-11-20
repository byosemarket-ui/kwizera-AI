/**
 * HFM MT5 instrument catalog contracts (STEP 1 discovery + STEP 2 metadata/classification).
 * Provider identity is always HFM_MT5. No live bid/ask persistence.
 */

import type { HfmMetadataQualityReport } from "./catalog-metadata-quality.js";

export const HFM_CATALOG_PROVIDER = "HFM_MT5" as const;
export const HFM_CATALOG_ENVIRONMENT = "demo" as const;

/** Primary categories. ENERGIES kept for STEP 1 compat; ENERGY accepted as API alias. */
export const HFM_CATALOG_CATEGORIES = [
  "FOREX",
  "METALS",
  "INDICES",
  "ENERGIES",
  "SHARES",
  "COMMODITIES",
  "CRYPTO",
  "BONDS",
  "ETFS",
  "FUTURES",
  "OPTIONS",
  "OTHER",
  "UNCLASSIFIED",
] as const;
export type HfmCatalogCategory = (typeof HFM_CATALOG_CATEGORIES)[number];

/** Normalize API filter aliases (e.g. ENERGY → ENERGIES). */
export function normalizeHfmCatalogCategory(input: string | null | undefined): HfmCatalogCategory | null {
  if (!input) return null;
  const u = input.trim().toUpperCase();
  if (u === "ENERGY") return "ENERGIES";
  if ((HFM_CATALOG_CATEGORIES as readonly string[]).includes(u)) return u as HfmCatalogCategory;
  return null;
}

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

export type HfmClassificationStatus =
  | "CONFIRMED"
  | "HIGH_CONFIDENCE"
  | "NEEDS_REVIEW"
  | "UNCLASSIFIED";

export interface HfmClassificationResult {
  category: HfmCatalogCategory;
  subcategory: string | null;
  classificationStatus: HfmClassificationStatus;
  /** Legacy ordinal band kept for STEP 1 consumers. */
  confidence: HfmClassificationConfidence;
  /** Documented 0..1 score. */
  classificationConfidence: number;
  classificationMethod: HfmClassificationMethod;
  /** Alias of classificationMethod for STEP 1 field name `method`. */
  method: HfmClassificationMethod;
  classificationEvidence: string[];
  /** Alias of classificationEvidence for STEP 1 field name `evidence`. */
  evidence: string[];
  classificationWarnings: string[];
  classifiedAt: string;
  classifierVersion: string;
}

export interface HfmSessionWindow {
  fromSec: number;
  toSec: number;
}

export interface HfmSessionDaySummary {
  tradeFrom: number | null;
  tradeTo: number | null;
  quoteFrom: number | null;
  quoteTo: number | null;
  /** Multi-index trade windows when EA emits them (preferred over tradeFrom/To alone). */
  tradeWindows?: HfmSessionWindow[];
  quoteWindows?: HfmSessionWindow[];
}

export interface HfmSessionSummary {
  tradeSessionDays: number;
  quoteSessionDays: number;
  sessionIndexScan?: number;
  /**
   * Optional nested map. Live catalog rows often flatten day keys ("0".."6")
   * onto this object alongside tradeSessionDays — parsers must accept both.
   */
  days?: Record<string, HfmSessionDaySummary>;
  [dayKey: string]: unknown;
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
  marginHedged: number | null;
  marginHedgedUseLeg: boolean | null;
  liquidityRate: number | null;
  spread: number | null;
  spreadFloat: boolean | null;
  tradeAllowed: boolean | null;
  startTime: number | null;
  expirationTime: number | null;
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
  metadataQuality: HfmMetadataQualityReport;
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
  schemaVersion: 2;
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
