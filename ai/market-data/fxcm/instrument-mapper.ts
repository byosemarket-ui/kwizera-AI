/**
 * Map FXCM provider symbols → canonical / display forms.
 * Driven by provider metadata — never invents instruments or prices.
 */
import { FXCM_PHASE31_CAPABILITIES } from "./config.js";
import { FXCM_INSTRUMENT_TYPE_MAP, type FxcmRawInstrument } from "./types.js";
import type { MarketAssetType, MarketInstrument, NormalizedMarketQuote } from "../providers/types.js";
import type {
  FxcmMappingConflict,
  FxcmMappingStatus,
  SafeFxcmDiscoveredInstrument,
} from "./instrument-discovery-types.js";

/** FXCM provider symbols are typically "EUR/USD". Canonical strips separators. */
export function toCanonicalFxcmSymbol(providerSymbol: string): string {
  return String(providerSymbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function toDisplayFxcmSymbol(providerSymbol: string): string {
  return String(providerSymbol ?? "").trim();
}

/** Currency-like code used for FOREX base/quote only — never invent exotic codes. */
export function isValidFxAssetCode(code: string | null | undefined): boolean {
  return typeof code === "string" && /^[A-Z]{3,6}$/.test(code);
}

export function splitFxPair(providerSymbol: string): { base: string | null; quote: string | null } {
  const parts = String(providerSymbol).trim().split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    const base = parts[0]!.trim().toUpperCase();
    const quote = parts[1]!.trim().toUpperCase();
    if (isValidFxAssetCode(base) && isValidFxAssetCode(quote)) {
      return { base, quote };
    }
    return { base: null, quote: null };
  }
  const canonical = toCanonicalFxcmSymbol(providerSymbol);
  if (canonical.length === 6 && /^[A-Z]{6}$/.test(canonical)) {
    return { base: canonical.slice(0, 3), quote: canonical.slice(3) };
  }
  return { base: null, quote: null };
}

export function mapFxcmInstrumentType(rawType: unknown, providerSymbol: string): MarketAssetType {
  const n = typeof rawType === "number" ? rawType : Number(rawType);
  if (Number.isFinite(n) && FXCM_INSTRUMENT_TYPE_MAP[n]) {
    return FXCM_INSTRUMENT_TYPE_MAP[n]!;
  }
  // Official type missing: slash FX pairs default to FOREX; never invent CFD/commodity.
  if (String(providerSymbol).includes("/")) return "FOREX";
  return "OTHER";
}

function phaseCapabilities(): MarketInstrument["capabilities"] {
  // Phase 31: historical + streaming + live candles; trading remains disabled.
  return { ...FXCM_PHASE31_CAPABILITIES };
}

export function mapFxcmRawInstrument(raw: FxcmRawInstrument): MarketInstrument | null {
  const providerSymbol = String(raw.symbol ?? "").trim();
  if (!providerSymbol) return null;
  // Reject whitespace-corrupted / empty-after-trim symbols.
  if (/\s/.test(providerSymbol)) return null;
  const marketType = mapFxcmInstrumentType(raw.instrumentType, providerSymbol);
  const canonicalSymbol = toCanonicalFxcmSymbol(providerSymbol);
  if (!canonicalSymbol) return null;

  let base: string | null = null;
  let quote: string | null = null;
  if (marketType === "FOREX") {
    const pair = splitFxPair(providerSymbol);
    base = pair.base;
    quote = pair.quote;
  }

  return {
    provider: "FXCM",
    providerSymbol,
    canonicalSymbol,
    displaySymbol: toDisplayFxcmSymbol(providerSymbol),
    marketType,
    baseAsset: base,
    quoteAsset: quote,
    status: raw.visible === false ? "hidden" : "available",
    capabilities: phaseCapabilities(),
    metadata: {
      order: typeof raw.order === "number" ? raw.order : null,
      instrumentType: typeof raw.instrumentType === "number" ? raw.instrumentType : null,
      visible: raw.visible !== false,
      source: "fxcm-socket-rest",
    },
  };
}

export interface FxcmMappedCatalog {
  instruments: MarketInstrument[];
  discovered: SafeFxcmDiscoveredInstrument[];
  conflicts: FxcmMappingConflict[];
}

function resolveMappingStatus(
  instrument: MarketInstrument,
  conflictCanonicals: Set<string>,
): { status: FxcmMappingStatus; source: "FXCM_METADATA" | "UNRESOLVED"; conflictReason: string | null } {
  if (conflictCanonicals.has(instrument.canonicalSymbol)) {
    return {
      status: "CONFLICT",
      source: "FXCM_METADATA",
      conflictReason: `Multiple FXCM instruments map to canonical ${instrument.canonicalSymbol}.`,
    };
  }
  if (instrument.marketType === "FOREX") {
    if (!isValidFxAssetCode(instrument.baseAsset) || !isValidFxAssetCode(instrument.quoteAsset)) {
      return {
        status: "UNRESOLVED",
        source: "UNRESOLVED",
        conflictReason: "FOREX instrument missing validated base/quote from provider symbol.",
      };
    }
  }
  if (!instrument.canonicalSymbol || !instrument.providerSymbol) {
    return { status: "UNRESOLVED", source: "UNRESOLVED", conflictReason: "Missing symbol identity." };
  }
  return { status: "VALIDATED", source: "FXCM_METADATA", conflictReason: null };
}

export function toSafeDiscoveredInstrument(
  instrument: MarketInstrument,
  mapping: { status: FxcmMappingStatus; source: "FXCM_METADATA" | "UNRESOLVED"; conflictReason: string | null },
): SafeFxcmDiscoveredInstrument {
  return {
    identity: {
      provider: "FXCM",
      marketType: instrument.marketType,
      providerSymbol: instrument.providerSymbol,
      canonicalSymbol: instrument.canonicalSymbol || null,
    },
    provider: "FXCM",
    providerSymbol: instrument.providerSymbol,
    canonicalSymbol: instrument.canonicalSymbol || null,
    displaySymbol: instrument.displaySymbol,
    marketType: instrument.marketType,
    baseAsset: instrument.baseAsset,
    quoteAsset: instrument.quoteAsset,
    status: instrument.status,
    mappingStatus: mapping.status,
    mappingSource: mapping.source,
    conflictReason: mapping.conflictReason,
    capabilities: {
      phaseEnabled: { ...instrument.capabilities },
      providerOfficialSurface: {
        instruments: true,
        quotes: "STREAMING_ENABLED",
        streaming: "STREAMING_ENABLED",
        historical: "HISTORICAL_ENABLED",
        candles: "HISTORICAL_ENABLED",
        trading: "DISABLED",
      },
    },
    metadata: {
      order: typeof instrument.metadata.order === "number" ? instrument.metadata.order : null,
      instrumentType: typeof instrument.metadata.instrumentType === "number"
        ? instrument.metadata.instrumentType
        : null,
      visible: instrument.metadata.visible !== false,
      source: "fxcm-socket-rest",
    },
  };
}

/**
 * Normalize a raw FXCM instrument list with duplicate + canonical-conflict detection.
 * Identity key = provider + marketType + providerSymbol (never canonical alone).
 */
export function mapFxcmInstrumentCatalog(rawList: unknown): FxcmMappedCatalog {
  const instruments = Array.isArray(rawList)
    ? rawList
    : (rawList && typeof rawList === "object" && Array.isArray((rawList as { instrument?: unknown }).instrument))
      ? (rawList as { instrument: unknown[] }).instrument
      : (rawList && typeof rawList === "object" && Array.isArray((rawList as { data?: { instrument?: unknown } }).data?.instrument))
        ? (rawList as { data: { instrument: unknown[] } }).data.instrument
        : [];

  const byProviderKey = new Map<string, MarketInstrument>();
  const canonicalOwners = new Map<string, string[]>();

  for (const item of instruments) {
    if (!item || typeof item !== "object") continue;
    const mapped = mapFxcmRawInstrument(item as FxcmRawInstrument);
    if (!mapped) continue;
    const key = `FXCM|${mapped.marketType}|${mapped.providerSymbol}`;
    if (byProviderKey.has(key)) {
      // Duplicate provider identity — keep first, do not silently overwrite differing metadata.
      continue;
    }
    byProviderKey.set(key, mapped);
    const owners = canonicalOwners.get(mapped.canonicalSymbol) ?? [];
    owners.push(mapped.providerSymbol);
    canonicalOwners.set(mapped.canonicalSymbol, owners);
  }

  const conflicts: FxcmMappingConflict[] = [];
  const conflictCanonicals = new Set<string>();
  for (const [canonical, owners] of canonicalOwners) {
    const unique = [...new Set(owners)];
    if (unique.length > 1) {
      conflictCanonicals.add(canonical);
      conflicts.push({
        canonicalSymbol: canonical,
        providerSymbols: unique,
        reason: "Multiple distinct FXCM provider symbols resolve to the same canonical symbol.",
      });
    }
  }

  const list = [...byProviderKey.values()];
  const discovered = list.map((inst) => {
    const mapping = resolveMappingStatus(inst, conflictCanonicals);
    return toSafeDiscoveredInstrument(inst, mapping);
  });

  return { instruments: list, discovered, conflicts };
}

/** Backward-compatible list mapper used by Phase 25 tests/provider. */
export function mapFxcmInstrumentList(rawList: unknown): MarketInstrument[] {
  return mapFxcmInstrumentCatalog(rawList).instruments;
}

/** Create empty normalized quote contract — never fabricates bid/ask/mid/last. */
export function emptyNormalizedQuote(instrument: MarketInstrument): NormalizedMarketQuote {
  return {
    provider: "FXCM",
    marketType: instrument.marketType,
    providerSymbol: instrument.providerSymbol,
    canonicalSymbol: instrument.canonicalSymbol,
    providerTimestamp: null,
    normalizedTimestamp: new Date().toISOString(),
    bid: null,
    ask: null,
    mid: null,
    last: null,
    source: "fxcm-socket-rest",
    dataQuality: "NO_DATA",
  };
}

export function filterDiscoveredInstruments(
  instruments: SafeFxcmDiscoveredInstrument[],
  filters: {
    marketType?: string | null;
    search?: string | null;
    status?: string | null;
    baseAsset?: string | null;
    quoteAsset?: string | null;
    mappingStatus?: string | null;
  },
): SafeFxcmDiscoveredInstrument[] {
  const marketType = filters.marketType?.trim().toUpperCase() || null;
  const search = filters.search?.trim().toUpperCase() || null;
  const status = filters.status?.trim().toLowerCase() || null;
  const baseAsset = filters.baseAsset?.trim().toUpperCase() || null;
  const quoteAsset = filters.quoteAsset?.trim().toUpperCase() || null;
  const mappingStatus = filters.mappingStatus?.trim().toUpperCase() || null;

  return instruments.filter((inst) => {
    if (marketType && inst.marketType !== marketType) return false;
    if (status && inst.status !== status) return false;
    if (baseAsset && inst.baseAsset !== baseAsset) return false;
    if (quoteAsset && inst.quoteAsset !== quoteAsset) return false;
    if (mappingStatus && inst.mappingStatus !== mappingStatus) return false;
    if (search) {
      const hay = [
        inst.providerSymbol,
        inst.canonicalSymbol ?? "",
        inst.displaySymbol,
        inst.baseAsset ?? "",
        inst.quoteAsset ?? "",
        inst.marketType,
      ].join(" ").toUpperCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

/** Assert a discovery payload never contains credential material. */
export function assertSafeDiscoveryPayload(payload: unknown, accessToken: string | null): void {
  const json = JSON.stringify(payload);
  if (accessToken && accessToken.length >= 8 && json.includes(accessToken)) {
    throw new Error("FXCM discovery payload leaked access token.");
  }
  if (/Bearer\s+[A-Za-z0-9_-]{8,}/i.test(json)) {
    throw new Error("FXCM discovery payload leaked Bearer token.");
  }
  if (/"authorizationHeader"\s*:/i.test(json) || /"accessToken"\s*:/i.test(json) || /"password"\s*:/i.test(json)) {
    throw new Error("FXCM discovery payload leaked credential fields.");
  }
}
