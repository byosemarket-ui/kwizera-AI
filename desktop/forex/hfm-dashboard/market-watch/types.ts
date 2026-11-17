/**
 * STEP 3A — HFM Market Watch frontend contracts.
 * Mirrors confirmed backend catalog / quote fields only. No screenshot sample data.
 */

import type { HfmCatalogCategory } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmConnectionState, HfmFreshness, HfmSseStatus } from "../types";

export type HfmMarketWatchViewId = "dashboard" | "market-watch";

export type HfmMwProviderUiStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "CONNECTING"
  | "DEGRADED"
  | "ERROR"
  | "AUTH_REQUIRED"
  | "WAITING";

export type HfmMwMetricAvailability = "loading" | "available" | "unavailable" | "error";

export type HfmMwCategoryFilter = "ALL" | HfmCatalogCategory;

export interface HfmMwCategoryCount {
  category: HfmCatalogCategory;
  count: number;
}

export interface HfmMwCatalogSummary {
  available: boolean;
  totalInstruments: number | null;
  catalogVersion: string | null;
  brokerServer: string | null;
  freshness: string | null;
  discoveryStatus: string | null;
  categories: HfmMwCategoryCount[];
  unavailableReason: string | null;
  ingestedAt: string | null;
}

/** Movement buckets only when a broker daily reference baseline exists. */
export interface HfmMwMovementSummary {
  availability: HfmMwMetricAvailability;
  rising: number | null;
  falling: number | null;
  unchanged: number | null;
  reason: string | null;
}

export interface HfmMwTradingSessionSummary {
  availability: HfmMwMetricAvailability;
  /** Named session only when backend provides it — never invented. */
  name: string | null;
  status: string | null;
  openTime: string | null;
  closeTime: string | null;
  timeZone: string | null;
  reason: string | null;
}

/**
 * Selected instrument panel contract for STEP 3A foundation / STEP 3B interactions.
 * All quote fields remain null until a real selection + validated quote exists.
 */
export interface HfmMwSelectedInstrument {
  symbol: string;
  description: string | null;
  category: HfmCatalogCategory | string | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
  quoteStatus: string | null;
  quoteTimestamp: number | null;
  metadataCompleteness: number | null;
  subscriptionStatus: string | null;
  freshness: HfmFreshness | null;
}

export interface HfmMwSessionRow {
  name: string;
  openTime: string | null;
  closeTime: string | null;
  status: string | null;
  timeZone: string | null;
  nextTransition: string | null;
}

export interface HfmMwProviderIdentity {
  provider: "HFM_MT5";
  environment: "demo";
  platform: "MT5";
  label: "HFM MT5 DEMO";
}

export interface HfmMwLoadState {
  catalog: "idle" | "loading" | "ready" | "error" | "auth_required";
  catalogError: string | null;
}

export interface HfmMwRealtimeHints {
  sseStatus: HfmSseStatus;
  connectionState: HfmConnectionState;
  freshness: HfmFreshness;
  terminalRunning: boolean | null;
  authenticated: boolean | null;
  lastEventAt: number | null;
  lastError: string | null;
  accountLogin: string | null;
  accountServer: string | null;
  accountCurrency: string | null;
}

export const HFM_MW_PROVIDER: HfmMwProviderIdentity = {
  provider: "HFM_MT5",
  environment: "demo",
  platform: "MT5",
  label: "HFM MT5 DEMO",
};

/** Display order for category pills (All is synthetic). */
export const HFM_MW_CATEGORY_ORDER: HfmCatalogCategory[] = [
  "FOREX",
  "METALS",
  "INDICES",
  "ENERGIES",
  "SHARES",
  "CRYPTO",
  "COMMODITIES",
  "BONDS",
  "ETFS",
  "FUTURES",
  "OPTIONS",
  "OTHER",
  "UNCLASSIFIED",
];

export const HFM_MW_CATEGORY_LABELS: Record<HfmCatalogCategory, string> = {
  FOREX: "Forex",
  METALS: "Metals",
  INDICES: "Indices",
  ENERGIES: "Energies",
  SHARES: "Shares",
  CRYPTO: "Crypto",
  COMMODITIES: "Commodities",
  BONDS: "Bonds",
  ETFS: "ETFs",
  FUTURES: "Futures",
  OPTIONS: "Options",
  OTHER: "Other",
  UNCLASSIFIED: "Unclassified",
};
