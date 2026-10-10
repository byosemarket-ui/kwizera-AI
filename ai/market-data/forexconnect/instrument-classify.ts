/**
 * Phase 36D — ForexConnect instrument classification for the Multi-Asset Market Explorer.
 * Rules are conservative: prefer explicit suffixes / verified identifiers; otherwise Other.
 * Never invent instruments. Provider identity stays FOREXCONNECT.
 */
import type { ForexConnectInstrument } from "./types.js";
import type { MarketAssetType } from "../providers/types.js";

export type ForexConnectExplorerCategoryId =
  | "all"
  | "forex"
  | "indices"
  | "commodities"
  | "metals"
  | "energy"
  | "forex_ndf"
  | "forex_baskets"
  | "treasury"
  | "cryptocurrency"
  | "etfs"
  | "stock_baskets"
  | "shares_us"
  | "shares_uk"
  | "shares_ca"
  | "shares_de"
  | "shares_fr"
  | "shares_jp"
  | "shares_hk"
  | "shares_nl"
  | "other";

export interface ForexConnectExplorerCategoryDef {
  id: ForexConnectExplorerCategoryId;
  label: string;
  group: "markets" | "shares" | "other";
}

export const FOREXCONNECT_EXPLORER_CATEGORIES: ForexConnectExplorerCategoryDef[] = [
  { id: "all", label: "All Markets", group: "markets" },
  { id: "forex", label: "Forex", group: "markets" },
  { id: "indices", label: "Indices", group: "markets" },
  { id: "commodities", label: "Commodities", group: "markets" },
  { id: "metals", label: "Metals", group: "markets" },
  { id: "energy", label: "Energy", group: "markets" },
  { id: "forex_ndf", label: "Forex NDFs", group: "markets" },
  { id: "forex_baskets", label: "Forex Baskets", group: "markets" },
  { id: "treasury", label: "Treasury / Bonds", group: "markets" },
  { id: "cryptocurrency", label: "Cryptocurrency", group: "markets" },
  { id: "etfs", label: "ETFs", group: "markets" },
  { id: "stock_baskets", label: "Stock Baskets", group: "markets" },
  { id: "shares_us", label: "US Shares", group: "shares" },
  { id: "shares_uk", label: "UK Shares", group: "shares" },
  { id: "shares_ca", label: "Canadian Shares", group: "shares" },
  { id: "shares_de", label: "German Shares", group: "shares" },
  { id: "shares_fr", label: "French Shares", group: "shares" },
  { id: "shares_jp", label: "Japanese Shares", group: "shares" },
  { id: "shares_hk", label: "Hong Kong Shares", group: "shares" },
  { id: "shares_nl", label: "Dutch Shares", group: "shares" },
  { id: "other", label: "Other / Unclassified", group: "other" },
];

export type ClassificationSource =
  | "provider_instrument_type"
  | "share_suffix"
  | "symbol_rule"
  | "fallback_other";

export interface ClassifiedForexConnectInstrument {
  provider: "FOREXCONNECT";
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  offerId: string | null;
  description: string | null;
  environment: string | null;
  environmentLabel: string | null;
  categoryId: Exclude<ForexConnectExplorerCategoryId, "all">;
  categoryLabel: string;
  marketType: MarketAssetType;
  classificationSource: ClassificationSource;
  classificationConfidence: "high" | "medium" | "low";
  baseAsset: string | null;
  quoteAsset: string | null;
  status: string;
  raw: ForexConnectInstrument;
}

export interface ForexConnectCatalogSummary {
  rawCount: number;
  deduplicatedCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  categoryCounts: Record<ForexConnectExplorerCategoryId, number>;
  fetchedAt: string | null;
  environment: string | null;
  environmentLabel: string | null;
  provider: "FOREXCONNECT";
}

const FIAT = new Set([
  "USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "SEK", "NOK",
  "DKK", "HKD", "SGD", "MXN", "ZAR", "TRY", "HUF", "PLN", "CNH", "CNY",
  "INR", "KRW", "TWD", "CLP", "COP",
]);

const CRYPTO_BASE = new Set([
  "BTC", "ETH", "LTC", "BCH", "XRP", "XLM", "ADA", "DOT", "LINK", "SOL",
  "AVAX", "DOGE", "BNB", "POL", "KSM", "XTZ",
]);

const METAL_SYMBOLS = new Set([
  "XAU/USD", "XAG/USD", "ALUMSPOT", "COPPER", "LEADSPOT", "NICKELSPOT", "ZINCSPOT",
]);

const ENERGY_SYMBOLS = new Set([
  "UKOIL", "UKOILSPOT", "USOIL", "USOILSPOT", "NGAS", "GASOLINEF", "HEATINGOILF", "URANIUM",
]);

const COMMODITY_SYMBOLS = new Set([
  "CORNF", "COFFEENYF", "SOYF", "SUGARNYF", "WHEATF", "LCATTLEF", "CARBONF",
]);

const INDEX_SYMBOLS = new Set([
  "AUS200", "CHN50", "EUSTX50", "FRA40", "GER30", "HKG33", "JPN225",
  "NAS100", "SPX500", "UK100", "US2000", "US30", "VOLX",
]);

const TREASURY_SYMBOLS = new Set([
  "10USNOTE", "2USNOTE", "5USNOTE", "BUND", "BOBL", "SCHATZ",
  "EURIBOR3M", "SONIA3M", "FED30D", "IBHY",
]);

const FOREX_BASKET_SYMBOLS = new Set([
  "EMBASKET", "JPYBASKET", "USDOLLAR",
]);

const STOCK_BASKET_SYMBOLS = new Set([
  "AIRLINES", "ATMX", "BIOTECH", "CANNABIS", "CASINOS", "ESPORTS", "FAANG",
  "TRAVEL", "USEQUITIES", "WFH", "MAG7.24H", "CRYPTOSTOCK", "CRYPTOMAJOR",
]);

/** Conservative FXCM-style NDF / exotic EM cash pairs when no InstrumentType is present. */
const FOREX_NDF_SYMBOLS = new Set([
  "USD/INR", "USD/KRW", "USD/TWD", "USD/CLP", "USD/COP",
]);

const SHARE_SUFFIX_TO_CATEGORY: Record<string, Exclude<ForexConnectExplorerCategoryId, "all">> = {
  us: "shares_us",
  ext: "shares_us",
  uk: "shares_uk",
  ca: "shares_ca",
  de: "shares_de",
  fr: "shares_fr",
  jp: "shares_jp",
  hk: "shares_hk",
  nl: "shares_nl",
};

const CATEGORY_LABEL = Object.fromEntries(
  FOREXCONNECT_EXPLORER_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<ForexConnectExplorerCategoryId, string>;

function categoryMarketType(categoryId: Exclude<ForexConnectExplorerCategoryId, "all">): MarketAssetType {
  switch (categoryId) {
    case "forex":
    case "forex_ndf":
    case "forex_baskets":
      return "FOREX";
    case "indices":
      return "INDEX";
    case "commodities":
    case "metals":
    case "energy":
      return "COMMODITY";
    case "treasury":
      return "TREASURY";
    case "cryptocurrency":
      return "CRYPTO";
    case "etfs":
    case "stock_baskets":
    case "shares_us":
    case "shares_uk":
    case "shares_ca":
    case "shares_de":
    case "shares_fr":
    case "shares_jp":
    case "shares_hk":
    case "shares_nl":
      return "SHARE";
    default:
      return "OTHER";
  }
}

function normalizeProviderType(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function classifyFromProviderType(
  typeRaw: unknown,
): { categoryId: Exclude<ForexConnectExplorerCategoryId, "all">; confidence: "high" | "medium" } | null {
  const t = normalizeProviderType(typeRaw);
  if (!t) return null;
  if (t.includes("forex") && t.includes("ndf")) return { categoryId: "forex_ndf", confidence: "high" };
  if (t.includes("basket") && t.includes("forex")) return { categoryId: "forex_baskets", confidence: "high" };
  // Generic "Forex" / numeric type alone is not enough to force Forex vs NDF/basket —
  // fall through to symbol rules for those distinctions.
  if (t.includes("forex") || t === "1" || t === "fx") return null;
  if (t.includes("index") || t.includes("indice")) return { categoryId: "indices", confidence: "high" };
  if (t.includes("metal")) return { categoryId: "metals", confidence: "high" };
  if (t.includes("energy") || t.includes("oil") || t.includes("gas")) {
    return { categoryId: "energy", confidence: "high" };
  }
  if (t.includes("commodity") || t.includes("agricult")) {
    return { categoryId: "commodities", confidence: "high" };
  }
  if (t.includes("bond") || t.includes("treasury") || t.includes("interest")) {
    return { categoryId: "treasury", confidence: "high" };
  }
  if (t.includes("crypto") || t.includes("digital")) {
    return { categoryId: "cryptocurrency", confidence: "high" };
  }
  if (t.includes("etf")) return { categoryId: "etfs", confidence: "high" };
  if (t.includes("share") || t.includes("equity") || t.includes("stock")) {
    return { categoryId: "shares_us", confidence: "medium" };
  }
  return null;
}

function shareSuffix(symbol: string): string | null {
  const m = symbol.trim().match(/\.([A-Za-z]+)$/);
  return m ? m[1]!.toLowerCase() : null;
}

function isForexPair(symbol: string): boolean {
  const m = symbol.trim().toUpperCase().match(/^([A-Z]{3})\/([A-Z]{3})$/);
  if (!m) return false;
  const base = m[1]!;
  const quote = m[2]!;
  if (CRYPTO_BASE.has(base) || CRYPTO_BASE.has(quote)) return false;
  if (base === "XAU" || base === "XAG") return false;
  return FIAT.has(base) && FIAT.has(quote);
}

function isCryptoPair(symbol: string): boolean {
  const m = symbol.trim().toUpperCase().match(/^([A-Z0-9]{2,6})\/([A-Z]{3})$/);
  if (!m) return false;
  return CRYPTO_BASE.has(m[1]!) || CRYPTO_BASE.has(m[2]!);
}

export function classifyForexConnectInstrument(
  instrument: ForexConnectInstrument,
  options?: { environment?: string | null; environmentLabel?: string | null },
): ClassifiedForexConnectInstrument {
  const providerSymbol = String(instrument.providerSymbol ?? "").trim();
  const upper = providerSymbol.toUpperCase();
  const compact = upper.replace(/[^A-Z0-9.]/g, "");
  const description = instrument.description
    ? String(instrument.description)
    : (instrument.displaySymbol ? String(instrument.displaySymbol) : null);

  let categoryId: Exclude<ForexConnectExplorerCategoryId, "all"> = "other";
  let source: ClassificationSource = "fallback_other";
  let confidence: "high" | "medium" | "low" = "low";

  const fromType = classifyFromProviderType(
    instrument.instrumentType ?? instrument.assetClass ?? instrument.metadataType,
  );
  if (fromType) {
    categoryId = fromType.categoryId;
    source = "provider_instrument_type";
    confidence = fromType.confidence;
  } else {
    const suffix = shareSuffix(providerSymbol);
    if (suffix && ["ecomm", "tech", "auto", "banks"].includes(suffix)) {
      // Sector baskets like CHN.ECOMM / MAG7.TECH — not country share listings.
      categoryId = "stock_baskets";
      source = "symbol_rule";
      confidence = "medium";
    } else if (suffix && SHARE_SUFFIX_TO_CATEGORY[suffix]) {
      categoryId = SHARE_SUFFIX_TO_CATEGORY[suffix]!;
      source = "share_suffix";
      confidence = "high";
    } else if (FOREX_NDF_SYMBOLS.has(upper)) {
      categoryId = "forex_ndf";
      source = "symbol_rule";
      confidence = "medium";
    } else if (isCryptoPair(providerSymbol)) {
      categoryId = "cryptocurrency";
      source = "symbol_rule";
      confidence = "high";
    } else if (METAL_SYMBOLS.has(upper) || METAL_SYMBOLS.has(compact)) {
      categoryId = "metals";
      source = "symbol_rule";
      confidence = "high";
    } else if (ENERGY_SYMBOLS.has(upper) || ENERGY_SYMBOLS.has(compact)) {
      categoryId = "energy";
      source = "symbol_rule";
      confidence = "high";
    } else if (COMMODITY_SYMBOLS.has(upper) || COMMODITY_SYMBOLS.has(compact)) {
      categoryId = "commodities";
      source = "symbol_rule";
      confidence = "high";
    } else if (INDEX_SYMBOLS.has(upper) || INDEX_SYMBOLS.has(compact)) {
      categoryId = "indices";
      source = "symbol_rule";
      confidence = "high";
    } else if (TREASURY_SYMBOLS.has(upper) || TREASURY_SYMBOLS.has(compact)) {
      categoryId = "treasury";
      source = "symbol_rule";
      confidence = "high";
    } else if (FOREX_BASKET_SYMBOLS.has(upper) || FOREX_BASKET_SYMBOLS.has(compact)) {
      categoryId = "forex_baskets";
      source = "symbol_rule";
      confidence = "high";
    } else if (STOCK_BASKET_SYMBOLS.has(upper) || STOCK_BASKET_SYMBOLS.has(compact)) {
      categoryId = "stock_baskets";
      source = "symbol_rule";
      confidence = "medium";
    } else if (isForexPair(providerSymbol)) {
      categoryId = "forex";
      source = "symbol_rule";
      confidence = "high";
    } else {
      categoryId = "other";
      source = "fallback_other";
      confidence = "low";
    }
  }

  return {
    provider: "FOREXCONNECT",
    providerSymbol,
    canonicalSymbol: String(instrument.canonicalSymbol ?? providerSymbol.replace(/[^A-Za-z0-9]/g, "")).toUpperCase(),
    displaySymbol: String(instrument.displaySymbol ?? providerSymbol),
    offerId: instrument.offerId != null ? String(instrument.offerId) : null,
    description,
    environment: options?.environment ?? null,
    environmentLabel: options?.environmentLabel ?? null,
    categoryId,
    categoryLabel: CATEGORY_LABEL[categoryId],
    marketType: categoryMarketType(categoryId),
    classificationSource: source,
    classificationConfidence: confidence,
    baseAsset: instrument.baseAsset ?? null,
    quoteAsset: instrument.quoteAsset ?? null,
    status: String(instrument.status ?? "available"),
    raw: instrument,
  };
}

export function dedupeForexConnectInstruments(
  instruments: ForexConnectInstrument[],
): ForexConnectInstrument[] {
  const seen = new Set<string>();
  const out: ForexConnectInstrument[] = [];
  for (const item of instruments) {
    const key = String(item.canonicalSymbol || item.providerSymbol || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildForexConnectCatalog(
  instruments: ForexConnectInstrument[],
  options?: {
    environment?: string | null;
    environmentLabel?: string | null;
    fetchedAt?: string | null;
  },
): {
  instruments: ClassifiedForexConnectInstrument[];
  summary: ForexConnectCatalogSummary;
} {
  const rawCount = instruments.length;
  const deduped = dedupeForexConnectInstruments(instruments);
  const classified = deduped.map((item) => classifyForexConnectInstrument(item, options));

  const categoryCounts = Object.fromEntries(
    FOREXCONNECT_EXPLORER_CATEGORIES.map((c) => [c.id, 0]),
  ) as Record<ForexConnectExplorerCategoryId, number>;
  categoryCounts.all = classified.length;
  for (const item of classified) {
    categoryCounts[item.categoryId] += 1;
  }

  return {
    instruments: classified,
    summary: {
      rawCount,
      deduplicatedCount: classified.length,
      classifiedCount: classified.filter((i) => i.categoryId !== "other").length,
      unclassifiedCount: classified.filter((i) => i.categoryId === "other").length,
      categoryCounts,
      fetchedAt: options?.fetchedAt ?? null,
      environment: options?.environment ?? null,
      environmentLabel: options?.environmentLabel ?? null,
      provider: "FOREXCONNECT",
    },
  };
}

export function filterClassifiedInstruments(
  instruments: ClassifiedForexConnectInstrument[],
  options: {
    categoryId?: ForexConnectExplorerCategoryId;
    query?: string;
  },
): ClassifiedForexConnectInstrument[] {
  const categoryId = options.categoryId ?? "all";
  const q = String(options.query ?? "").trim().toUpperCase();
  return instruments.filter((item) => {
    if (categoryId !== "all" && item.categoryId !== categoryId) return false;
    if (!q) return true;
    const hay = [
      item.providerSymbol,
      item.canonicalSymbol,
      item.displaySymbol,
      item.description ?? "",
      item.categoryLabel,
      item.offerId ?? "",
    ].join(" ").toUpperCase();
    return hay.includes(q);
  });
}
