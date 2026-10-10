/**
 * Phase 36D/36F — ForexConnect instrument classification for the Multi-Asset Market Explorer.
 * Prefer official Offers InstrumentType (numeric FXCM codes + labels), then symbol conventions.
 * Never invent instruments. Provider identity stays FOREXCONNECT.
 */
import type { ForexConnectInstrument } from "./types.js";
import type { MarketAssetType } from "../providers/types.js";

export type ForexConnectExplorerCategoryId =
  | "all"
  | "forex"
  | "indices"
  | "commodities"
  | "agriculture"
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
  { id: "agriculture", label: "Agricultural", group: "markets" },
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
  tradingStatus: string | null;
  instrumentType: string | null;
  instrumentTypeLabel: string | null;
  searchAliases: string[];
  dataAvailability: "AVAILABLE_IN_CATALOG" | "SESSION_CLOSED" | "UNKNOWN";
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

/** Official FXCM Offers InstrumentType numeric codes observed on Demo. */
export const FXCM_INSTRUMENT_TYPE_LABELS: Record<string, string> = {
  "1": "Forex",
  "2": "Indices",
  "3": "Commodity",
  "4": "Treasury",
  "5": "Bullion",
  "7": "Forex Basket",
  "8": "Shares",
  "9": "Crypto",
};

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

const AGRICULTURE_SYMBOLS = new Set([
  "CORNF", "COFFEENYF", "SOYF", "SUGARNYF", "WHEATF", "LCATTLEF",
]);

const COMMODITY_SYMBOLS = new Set([
  "CARBONF",
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
  "TRAVEL", "USEQUITIES", "WFH", "MAG7.24H", "CRYPTOSTOCK",
]);

/** Conservative FXCM-style NDF / exotic EM cash pairs (still InstrumentType 1 on Demo). */
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

/** Trading Station common names → provider symbols (search only; never invent catalog rows). */
const SYMBOL_SEARCH_ALIASES: Record<string, string[]> = {
  "XAU/USD": ["GOLD", "XAU"],
  "XAG/USD": ["SILVER", "XAG"],
  USOILSPOT: ["US OIL", "CRUDE", "WTI"],
  UKOILSPOT: ["BRENT", "UK OIL"],
  USOIL: ["US OIL FUTURES"],
  UKOIL: ["UK OIL FUTURES"],
  NGAS: ["NATURAL GAS", "NATGAS"],
  CORNF: ["CORN"],
  SOYF: ["SOY", "SOYBEAN", "SOYBEANS"],
  WHEATF: ["WHEAT"],
  COFFEENYF: ["COFFEE"],
  SUGARNYF: ["SUGAR"],
  LCATTLEF: ["CATTLE", "LIVE CATTLE"],
  GASOLINEF: ["GASOLINE", "RBOB"],
  HEATINGOILF: ["HEATING OIL"],
  ALUMSPOT: ["ALUMINUM", "ALUMINIUM"],
  COPPER: ["HG COPPER"],
  LEADSPOT: ["LEAD"],
  NICKELSPOT: ["NICKEL"],
  ZINCSPOT: ["ZINC"],
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
    case "agriculture":
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

function compactSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9.]/g, "");
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

function refineCommodityCategory(
  providerSymbol: string,
): Exclude<ForexConnectExplorerCategoryId, "all"> {
  const upper = providerSymbol.toUpperCase();
  const compact = compactSymbol(providerSymbol);
  if (ENERGY_SYMBOLS.has(upper) || ENERGY_SYMBOLS.has(compact)) return "energy";
  if (METAL_SYMBOLS.has(upper) || METAL_SYMBOLS.has(compact)) return "metals";
  if (AGRICULTURE_SYMBOLS.has(upper) || AGRICULTURE_SYMBOLS.has(compact)) return "agriculture";
  if (COMMODITY_SYMBOLS.has(upper) || COMMODITY_SYMBOLS.has(compact)) return "commodities";
  return "commodities";
}

function refineShareCategory(
  providerSymbol: string,
): { categoryId: Exclude<ForexConnectExplorerCategoryId, "all">; source: ClassificationSource; confidence: "high" | "medium" | "low" } {
  const upper = providerSymbol.toUpperCase();
  const compact = compactSymbol(providerSymbol);
  const suffix = shareSuffix(providerSymbol);
  if (suffix && ["ecomm", "tech", "auto", "banks"].includes(suffix)) {
    return { categoryId: "stock_baskets", source: "symbol_rule", confidence: "medium" };
  }
  if (suffix && SHARE_SUFFIX_TO_CATEGORY[suffix]) {
    return {
      categoryId: SHARE_SUFFIX_TO_CATEGORY[suffix]!,
      source: "share_suffix",
      confidence: "high",
    };
  }
  if (STOCK_BASKET_SYMBOLS.has(upper) || STOCK_BASKET_SYMBOLS.has(compact)) {
    return { categoryId: "stock_baskets", source: "symbol_rule", confidence: "medium" };
  }
  if (ENERGY_SYMBOLS.has(upper) || ENERGY_SYMBOLS.has(compact)) {
    return { categoryId: "energy", source: "symbol_rule", confidence: "medium" };
  }
  // Equity CFD without a country suffix — keep selectable under Stock Baskets / Other, not US Shares.
  return { categoryId: "stock_baskets", source: "provider_instrument_type", confidence: "low" };
}

function classifyFromProviderType(
  typeRaw: unknown,
  providerSymbol: string,
): {
  categoryId: Exclude<ForexConnectExplorerCategoryId, "all">;
  confidence: "high" | "medium";
  source: ClassificationSource;
} | null {
  const t = normalizeProviderType(typeRaw);
  if (!t) return null;

  // Numeric FXCM InstrumentType codes (primary evidence on Demo Offers).
  if (t === "1" || t === "fx" || t === "forex") {
    if (FOREX_NDF_SYMBOLS.has(providerSymbol.toUpperCase())) {
      return { categoryId: "forex_ndf", confidence: "high", source: "symbol_rule" };
    }
    if (isForexPair(providerSymbol)) {
      return { categoryId: "forex", confidence: "high", source: "provider_instrument_type" };
    }
    // Type 1 but not a standard fiat pair — still Forex family; avoid forcing NDF.
    return { categoryId: "forex", confidence: "medium", source: "provider_instrument_type" };
  }
  if (t === "2" || t.includes("index") || t.includes("indice")) {
    return { categoryId: "indices", confidence: "high", source: "provider_instrument_type" };
  }
  if (t === "3" || t.includes("commodity") || t.includes("agricult")) {
    const refined = refineCommodityCategory(providerSymbol);
    return {
      categoryId: refined,
      confidence: refined === "commodities" ? "medium" : "high",
      source: refined === "commodities" ? "provider_instrument_type" : "symbol_rule",
    };
  }
  if (t === "4" || t.includes("bond") || t.includes("treasury") || t.includes("interest")) {
    return { categoryId: "treasury", confidence: "high", source: "provider_instrument_type" };
  }
  if (t === "5" || t.includes("metal") || t.includes("bullion")) {
    return { categoryId: "metals", confidence: "high", source: "provider_instrument_type" };
  }
  if (t === "7" || (t.includes("basket") && t.includes("forex"))) {
    return { categoryId: "forex_baskets", confidence: "high", source: "provider_instrument_type" };
  }
  if (t === "8" || t.includes("share") || t.includes("equity") || t.includes("stock")) {
    const share = refineShareCategory(providerSymbol);
    return {
      categoryId: share.categoryId,
      confidence: share.confidence === "low" ? "medium" : share.confidence,
      source: share.source,
    };
  }
  if (t === "9" || t.includes("crypto") || t.includes("digital")) {
    return { categoryId: "cryptocurrency", confidence: "high", source: "provider_instrument_type" };
  }
  if (t.includes("energy") || t.includes("oil") || t.includes("gas")) {
    return { categoryId: "energy", confidence: "high", source: "provider_instrument_type" };
  }
  if (t.includes("etf")) {
    return { categoryId: "etfs", confidence: "high", source: "provider_instrument_type" };
  }
  return null;
}

function classifyFromSymbolRules(
  providerSymbol: string,
): {
  categoryId: Exclude<ForexConnectExplorerCategoryId, "all">;
  source: ClassificationSource;
  confidence: "high" | "medium" | "low";
} {
  const upper = providerSymbol.toUpperCase();
  const compact = compactSymbol(providerSymbol);
  const suffix = shareSuffix(providerSymbol);

  if (suffix && ["ecomm", "tech", "auto", "banks"].includes(suffix)) {
    return { categoryId: "stock_baskets", source: "symbol_rule", confidence: "medium" };
  }
  if (suffix && SHARE_SUFFIX_TO_CATEGORY[suffix]) {
    return {
      categoryId: SHARE_SUFFIX_TO_CATEGORY[suffix]!,
      source: "share_suffix",
      confidence: "high",
    };
  }
  if (FOREX_NDF_SYMBOLS.has(upper)) {
    return { categoryId: "forex_ndf", source: "symbol_rule", confidence: "medium" };
  }
  if (isCryptoPair(providerSymbol)) {
    return { categoryId: "cryptocurrency", source: "symbol_rule", confidence: "high" };
  }
  if (METAL_SYMBOLS.has(upper) || METAL_SYMBOLS.has(compact)) {
    return { categoryId: "metals", source: "symbol_rule", confidence: "high" };
  }
  if (ENERGY_SYMBOLS.has(upper) || ENERGY_SYMBOLS.has(compact)) {
    return { categoryId: "energy", source: "symbol_rule", confidence: "high" };
  }
  if (AGRICULTURE_SYMBOLS.has(upper) || AGRICULTURE_SYMBOLS.has(compact)) {
    return { categoryId: "agriculture", source: "symbol_rule", confidence: "high" };
  }
  if (COMMODITY_SYMBOLS.has(upper) || COMMODITY_SYMBOLS.has(compact)) {
    return { categoryId: "commodities", source: "symbol_rule", confidence: "high" };
  }
  if (INDEX_SYMBOLS.has(upper) || INDEX_SYMBOLS.has(compact)) {
    return { categoryId: "indices", source: "symbol_rule", confidence: "high" };
  }
  if (TREASURY_SYMBOLS.has(upper) || TREASURY_SYMBOLS.has(compact)) {
    return { categoryId: "treasury", source: "symbol_rule", confidence: "high" };
  }
  if (FOREX_BASKET_SYMBOLS.has(upper) || FOREX_BASKET_SYMBOLS.has(compact)) {
    return { categoryId: "forex_baskets", source: "symbol_rule", confidence: "high" };
  }
  if (STOCK_BASKET_SYMBOLS.has(upper) || STOCK_BASKET_SYMBOLS.has(compact)) {
    return { categoryId: "stock_baskets", source: "symbol_rule", confidence: "medium" };
  }
  if (isForexPair(providerSymbol)) {
    return { categoryId: "forex", source: "symbol_rule", confidence: "high" };
  }
  return { categoryId: "other", source: "fallback_other", confidence: "low" };
}

function resolveTypeLabel(typeRaw: unknown): string | null {
  const raw = String(typeRaw ?? "").trim();
  if (!raw) return null;
  if (FXCM_INSTRUMENT_TYPE_LABELS[raw]) return FXCM_INSTRUMENT_TYPE_LABELS[raw]!;
  if (/^[a-z]/i.test(raw)) return raw;
  return null;
}

function resolveSearchAliases(providerSymbol: string): string[] {
  const upper = providerSymbol.toUpperCase();
  const compact = compactSymbol(providerSymbol);
  return SYMBOL_SEARCH_ALIASES[upper]
    ?? SYMBOL_SEARCH_ALIASES[compact]
    ?? [];
}

function resolveDataAvailability(
  tradingStatus: string | null,
  status: string,
): ClassifiedForexConnectInstrument["dataAvailability"] {
  const t = String(tradingStatus ?? "").trim().toUpperCase();
  if (t === "C" || t === "CLOSED") return "SESSION_CLOSED";
  if (t === "O" || t === "OPEN" || status === "available") return "AVAILABLE_IN_CATALOG";
  return "UNKNOWN";
}

export function classifyForexConnectInstrument(
  instrument: ForexConnectInstrument,
  options?: { environment?: string | null; environmentLabel?: string | null },
): ClassifiedForexConnectInstrument {
  const providerSymbol = String(instrument.providerSymbol ?? "").trim();
  const description = instrument.description
    ? String(instrument.description)
    : (instrument.displaySymbol ? String(instrument.displaySymbol) : null);
  const typeRaw = instrument.instrumentType ?? instrument.assetClass ?? instrument.metadataType;
  const instrumentType = typeRaw != null && String(typeRaw).trim() !== ""
    ? String(typeRaw).trim()
    : null;
  const instrumentTypeLabel = resolveTypeLabel(typeRaw);
  const tradingStatus = instrument.tradingStatus != null
    ? String(instrument.tradingStatus)
    : null;

  let categoryId: Exclude<ForexConnectExplorerCategoryId, "all"> = "other";
  let source: ClassificationSource = "fallback_other";
  let confidence: "high" | "medium" | "low" = "low";

  const fromType = classifyFromProviderType(typeRaw, providerSymbol);
  if (fromType) {
    categoryId = fromType.categoryId;
    source = fromType.source;
    confidence = fromType.confidence;
  } else {
    const fromSymbol = classifyFromSymbolRules(providerSymbol);
    categoryId = fromSymbol.categoryId;
    source = fromSymbol.source;
    confidence = fromSymbol.confidence;
  }

  const status = String(instrument.status ?? "available");
  const searchAliases = resolveSearchAliases(providerSymbol);

  return {
    provider: "FOREXCONNECT",
    providerSymbol,
    // Preserve dots in share symbols (AAPL.us) — matches sidecar canonicalization.
    canonicalSymbol: String(
      instrument.canonicalSymbol
        ?? providerSymbol.replace(/[^A-Za-z0-9.]/g, ""),
    ).toUpperCase(),
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
    status,
    tradingStatus,
    instrumentType,
    instrumentTypeLabel,
    searchAliases,
    dataAvailability: resolveDataAvailability(tradingStatus, status),
    raw: instrument,
  };
}

export function dedupeForexConnectInstruments(
  instruments: ForexConnectInstrument[],
): ForexConnectInstrument[] {
  const seen = new Set<string>();
  const out: ForexConnectInstrument[] = [];
  for (const item of instruments) {
    // Prefer providerSymbol identity so AAPL.us and hypothetical AAPL never collide wrongly.
    const key = String(item.providerSymbol || item.canonicalSymbol || "")
      .trim()
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
      item.instrumentTypeLabel ?? "",
      ...item.searchAliases,
    ].join(" ").toUpperCase();
    return hay.includes(q);
  });
}
