/**
 * Phase 27 — FXCM instrument discovery contracts (safe / public shapes).
 * Never includes tokens, Authorization headers, or session material.
 */
import type { MarketAssetType, MarketDataCapabilities } from "../providers/types.js";
import type { FxcmEnvironment } from "./config.js";

export const FXCM_MAPPING_STATUSES = [
  "VALIDATED",
  "UNRESOLVED",
  "CONFLICT",
] as const;
export type FxcmMappingStatus = (typeof FXCM_MAPPING_STATUSES)[number];

export const FXCM_CACHE_FRESHNESS = [
  "EMPTY",
  "FRESH",
  "STALE",
  "REFRESHING",
  "FAILED",
  "DISABLED",
  "NOT_CONFIGURED",
  "AUTH_REQUIRED",
] as const;
export type FxcmCacheFreshness = (typeof FXCM_CACHE_FRESHNESS)[number];

export const FXCM_DISCOVERY_STATUSES = [
  "DISABLED",
  "NOT_CONFIGURED",
  "READY",
  "REFRESHING",
  "STALE",
  "FAILED",
  "AUTHENTICATION_ERROR",
  "NETWORK_ERROR",
  "UNAVAILABLE",
] as const;
export type FxcmDiscoveryStatus = (typeof FXCM_DISCOVERY_STATUSES)[number];

export interface FxcmMarketIdentity {
  provider: "FXCM";
  marketType: MarketAssetType;
  providerSymbol: string;
  /** Canonical form when resolvable; never sufficient alone for identity. */
  canonicalSymbol: string | null;
}

export interface FxcmSymbolMapping {
  provider: "FXCM";
  providerSymbol: string;
  canonicalSymbol: string | null;
  displaySymbol: string;
  marketType: MarketAssetType;
  status: FxcmMappingStatus;
  source: "FXCM_METADATA" | "UNRESOLVED";
  conflictReason: string | null;
}

export interface SafeFxcmDiscoveredInstrument {
  identity: FxcmMarketIdentity;
  provider: "FXCM";
  providerSymbol: string;
  canonicalSymbol: string | null;
  displaySymbol: string;
  marketType: MarketAssetType;
  baseAsset: string | null;
  quoteAsset: string | null;
  status: "available" | "hidden" | "unknown";
  mappingStatus: FxcmMappingStatus;
  mappingSource: "FXCM_METADATA" | "UNRESOLVED";
  conflictReason: string | null;
  capabilities: {
    phaseEnabled: MarketDataCapabilities;
    /** Official surface used in this phase — discovery only. */
    providerOfficialSurface: {
      instruments: true;
      quotes: "NOT_ENABLED";
      streaming: "NOT_ENABLED";
      historical: "HISTORICAL_ENABLED" | "NOT_ENABLED";
      candles: "HISTORICAL_ENABLED" | "NOT_ENABLED";
      trading: "DISABLED";
    };
  };
  metadata: {
    order: number | null;
    instrumentType: number | null;
    visible: boolean;
    source: "fxcm-socket-rest";
  };
}

export interface FxcmMappingConflict {
  canonicalSymbol: string;
  providerSymbols: string[];
  reason: string;
}

export interface SafeFxcmDiscoveryResult {
  provider: "FXCM";
  environment: FxcmEnvironment;
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  discoveryStatus: FxcmDiscoveryStatus;
  freshness: FxcmCacheFreshness;
  source: "FXCM" | "CACHED" | "NONE";
  fetchedAt: string | null;
  count: number;
  instruments: SafeFxcmDiscoveredInstrument[];
  conflicts: FxcmMappingConflict[];
  authenticationState: string;
  marketData: "NOT_STARTED";
  liveStream: "NOT_ENABLED_YET";
  trading: "DISABLED";
  errorCode: string | null;
  errorMessage: string | null;
  note: string;
}
