/**
 * Phase 5B.1 — Canonical instrument reference from HFM catalog (no duplicate catalog).
 */
import type { HfmCatalogInstrument } from "../../catalog-types.js";
import {
  MIF_MARKET_DATA_CONTRACT_ID,
  MIF_MARKET_DATA_CONTRACT_VERSION,
  MIF_PROVIDER_ID,
  type MifProviderId,
  type MifSafetyFlags,
  type MifSourceDialect,
} from "./types.js";

export interface MifCanonicalInstrument extends MifSafetyFlags {
  contractId: typeof MIF_MARKET_DATA_CONTRACT_ID;
  contractVersion: typeof MIF_MARKET_DATA_CONTRACT_VERSION;
  providerId: MifProviderId;
  providerSymbol: string;
  canonicalSymbol: string | null;
  displaySymbol: string | null;
  catalogVersion: string | null;
  /**
   * Reserved for a stable catalog-row digest. Left null in 5B.1 because no
   * verified per-instrument hash algorithm is defined yet — do not invent a placeholder.
   */
  instrumentMetadataHash: string | null;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
  baseCurrency: string | null;
  quoteCurrency: string | null;
  contractSize: number | null;
  category: string | null;
  sourceDialect: MifSourceDialect;
  metadataComplete: boolean;
}

export function buildMifInstrumentStub(input: {
  providerSymbol: string;
  canonicalSymbol?: string | null;
  displaySymbol?: string | null;
}): MifCanonicalInstrument {
  const sym = String(input.providerSymbol || "").trim().toUpperCase();
  return {
    contractId: MIF_MARKET_DATA_CONTRACT_ID,
    contractVersion: MIF_MARKET_DATA_CONTRACT_VERSION,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: sym,
    canonicalSymbol: input.canonicalSymbol != null
      ? String(input.canonicalSymbol).trim().toUpperCase() || null
      : sym || null,
    displaySymbol: input.displaySymbol != null
      ? String(input.displaySymbol).trim() || null
      : sym || null,
    catalogVersion: null,
    instrumentMetadataHash: null,
    digits: null,
    point: null,
    tickSize: null,
    baseCurrency: null,
    quoteCurrency: null,
    contractSize: null,
    category: null,
    sourceDialect: "hfm.catalog-instrument",
    metadataComplete: false,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

/** Map trusted HFM catalog row → canonical instrument. Does not invent missing fields. */
export function mifInstrumentFromHfmCatalog(
  row: HfmCatalogInstrument,
): MifCanonicalInstrument {
  const providerSymbol = String(row.symbol || "").trim().toUpperCase();
  const digits = typeof row.digits === "number" && Number.isFinite(row.digits) ? row.digits : null;
  const point = typeof row.point === "number" && Number.isFinite(row.point) ? row.point : null;
  const tickSize = typeof row.tickSize === "number" && Number.isFinite(row.tickSize) ? row.tickSize : null;
  const catalogVersion = typeof row.catalogVersion === "string" && row.catalogVersion.trim()
    ? row.catalogVersion.trim()
    : null;
  const metadataComplete = digits != null && point != null && tickSize != null && Boolean(catalogVersion);

  return {
    contractId: MIF_MARKET_DATA_CONTRACT_ID,
    contractVersion: MIF_MARKET_DATA_CONTRACT_VERSION,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    canonicalSymbol: providerSymbol || null,
    displaySymbol: row.description?.trim() || providerSymbol || null,
    catalogVersion,
    // Prefer catalog snapshot checksum when callers pass it later; per-row hash not invented here.
    instrumentMetadataHash: null,
    digits,
    point,
    tickSize,
    baseCurrency: row.currencyBase,
    quoteCurrency: row.currencyProfit,
    contractSize: typeof row.contractSize === "number" && Number.isFinite(row.contractSize)
      ? row.contractSize
      : null,
    category: row.classification?.category ?? row.categoryRaw,
    sourceDialect: "hfm.catalog-instrument",
    metadataComplete,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
