/**
 * Map FXCM provider symbols → canonical / display forms.
 * Driven by provider metadata — never invents instruments or prices.
 */
import { FXCM_PHASE25_CAPABILITIES } from "./config.js";
import { FXCM_INSTRUMENT_TYPE_MAP, type FxcmRawInstrument } from "./types.js";
import type { MarketAssetType, MarketInstrument, NormalizedMarketQuote } from "../providers/types.js";

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

export function splitFxPair(providerSymbol: string): { base: string | null; quote: string | null } {
  const parts = String(providerSymbol).trim().split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { base: parts[0]!.toUpperCase(), quote: parts[1]!.toUpperCase() };
  }
  const canonical = toCanonicalFxcmSymbol(providerSymbol);
  if (canonical.length === 6) {
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

export function mapFxcmRawInstrument(raw: FxcmRawInstrument): MarketInstrument | null {
  const providerSymbol = String(raw.symbol ?? "").trim();
  if (!providerSymbol) return null;
  const marketType = mapFxcmInstrumentType(raw.instrumentType, providerSymbol);
  const { base, quote } = splitFxPair(providerSymbol);
  return {
    provider: "FXCM",
    providerSymbol,
    canonicalSymbol: toCanonicalFxcmSymbol(providerSymbol),
    displaySymbol: toDisplayFxcmSymbol(providerSymbol),
    marketType,
    baseAsset: base,
    quoteAsset: quote,
    status: raw.visible === false ? "hidden" : "available",
    capabilities: { ...FXCM_PHASE25_CAPABILITIES },
    metadata: {
      order: typeof raw.order === "number" ? raw.order : null,
      instrumentType: typeof raw.instrumentType === "number" ? raw.instrumentType : null,
      visible: raw.visible !== false,
      source: "fxcm-socket-rest",
    },
  };
}

export function mapFxcmInstrumentList(rawList: unknown): MarketInstrument[] {
  const instruments = Array.isArray(rawList)
    ? rawList
    : (rawList && typeof rawList === "object" && Array.isArray((rawList as { instrument?: unknown }).instrument))
      ? (rawList as { instrument: unknown[] }).instrument
      : (rawList && typeof rawList === "object" && Array.isArray((rawList as { data?: { instrument?: unknown } }).data?.instrument))
        ? (rawList as { data: { instrument: unknown[] } }).data.instrument
        : [];

  const out: MarketInstrument[] = [];
  const seen = new Set<string>();
  for (const item of instruments) {
    if (!item || typeof item !== "object") continue;
    const mapped = mapFxcmRawInstrument(item as FxcmRawInstrument);
    if (!mapped) continue;
    const key = `${mapped.provider}:${mapped.providerSymbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
  }
  return out;
}

/** Create empty normalized quote contract — Phase 25 never fabricates bid/ask/mid/last. */
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
