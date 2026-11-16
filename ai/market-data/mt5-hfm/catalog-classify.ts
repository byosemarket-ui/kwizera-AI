/**
 * Evidence-based HFM MT5 catalog classification.
 * Path / sector / industry / calc mode first; name heuristics only as last resort.
 */
import type {
  HfmCatalogCategory,
  HfmClassificationConfidence,
  HfmClassificationMethod,
  HfmClassificationResult,
  HfmRawCatalogSymbol,
} from "./catalog-types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function result(
  category: HfmCatalogCategory,
  method: HfmClassificationMethod,
  confidence: HfmClassificationConfidence,
  evidence: string[],
): HfmClassificationResult {
  return { category, method, confidence, evidence, classifiedAt: nowIso() };
}

function pathTokens(path: string | null | undefined): string {
  return String(path ?? "").toLowerCase().replace(/\\/g, "/");
}

function matchPathCategory(path: string): HfmCatalogCategory | null {
  const p = pathTokens(path);
  if (!p) return null;
  if (/(^|\/)(forex|fx|currenc)/.test(p)) return "FOREX";
  if (/(^|\/)(metal|xau|xag|gold|silver|platinum|palladium)/.test(p)) return "METALS";
  if (/(^|\/)(indic|index|indices|cash\s*index)/.test(p)) return "INDICES";
  if (/(^|\/)(energ|oil|brent|wti|gas|ngas|crude)/.test(p)) return "ENERGIES";
  if (/(^|\/)(share|stock|equity|equities|cfd.?share)/.test(p)) return "SHARES";
  if (/(^|\/)(commodit|soft|agricult|coffee|cocoa|sugar|wheat|corn)/.test(p)) return "COMMODITIES";
  return null;
}

function matchTextCategory(text: string): HfmCatalogCategory | null {
  const t = text.toLowerCase();
  if (!t) return null;
  if (/\b(forex|fx|currency pair|spot fx)\b/.test(t)) return "FOREX";
  if (/\b(gold|silver|platinum|palladium|metal)\b/.test(t)) return "METALS";
  if (/\b(index|indices|nasdaq|dow|dax|ftse|nikkei|spx|s&p)\b/.test(t)) return "INDICES";
  if (/\b(oil|brent|wti|crude|natural gas|energy)\b/.test(t)) return "ENERGIES";
  if (/\b(share|stock|equity|equities)\b/.test(t)) return "SHARES";
  if (/\b(commodity|commodities|coffee|cocoa|sugar|wheat|corn)\b/.test(t)) return "COMMODITIES";
  return null;
}

/** MT5 ENUM_SYMBOL_CALC_MODE commonly used values. */
function matchCalcMode(mode: number | null | undefined): HfmCatalogCategory | null {
  if (mode == null || !Number.isFinite(mode)) return null;
  // SYMBOL_CALC_MODE_FOREX = 0, FOREX_NO_LEVERAGE = 5
  if (mode === 0 || mode === 5) return "FOREX";
  // CFD / CFDIndex / CFDLeverage vary by build; treat index-ish separately when known.
  // SYMBOL_CALC_MODE_CFDINDEX often 2 on many builds.
  if (mode === 2) return "INDICES";
  // SYMBOL_CALC_MODE_CFD = 1, EXCH_* leave as null (need path/sector).
  return null;
}

/**
 * Name heuristic — deliberately narrow. Never treat 6 letters as Forex by default.
 * Only used when all metadata signals are absent.
 */
function matchNameHeuristic(symbol: string): { category: HfmCatalogCategory; evidence: string } | null {
  const u = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!u) return null;
  // Explicit metal codes only (not substring GOLD alone without path/desc).
  if (/^(XAU|XAG|XPT|XPD)[A-Z]{3}$/.test(u) || /^(XAU|XAG|XPT|XPD)USD$/.test(u)) {
    return { category: "METALS", evidence: `name_metal_code:${symbol}` };
  }
  if (/^(USOIL|UKOIL|BRENT|WTI|XTIUSD|XBRUSD|NGAS|NATGAS)/.test(u)) {
    return { category: "ENERGIES", evidence: `name_energy_code:${symbol}` };
  }
  if (/^(US30|US500|USTEC|NAS100|GER40|UK100|JP225|AUS200|FRA40|EU50)/.test(u)) {
    return { category: "INDICES", evidence: `name_index_code:${symbol}` };
  }
  return null;
}

export function classifyHfmCatalogSymbol(raw: Pick<
  HfmRawCatalogSymbol,
  | "symbol"
  | "path"
  | "sector"
  | "sectorName"
  | "industry"
  | "industryName"
  | "categoryRaw"
  | "tradeCalcMode"
  | "contractSize"
  | "description"
  | "currencyBase"
  | "currencyProfit"
>): HfmClassificationResult {
  const pathCat = matchPathCategory(raw.path ?? "");
  if (pathCat) {
    return result(pathCat, "SYMBOL_PATH", "HIGH", [`path:${raw.path}`]);
  }

  const sectorText = `${raw.sectorName ?? ""} ${raw.sector ?? ""}`.trim();
  const sectorCat = matchTextCategory(sectorText) ?? matchTextCategory(String(raw.sectorName ?? ""));
  if (sectorCat) {
    return result(sectorCat, "SECTOR", "HIGH", [`sector:${raw.sectorName ?? raw.sector}`]);
  }

  const industryText = `${raw.industryName ?? ""} ${raw.categoryRaw ?? ""}`.trim();
  const industryCat = matchTextCategory(industryText);
  if (industryCat) {
    return result(industryCat, "INDUSTRY", "MEDIUM", [
      `industry:${raw.industryName ?? raw.industry ?? ""}`,
      `categoryRaw:${raw.categoryRaw ?? ""}`,
    ]);
  }

  const catRaw = matchTextCategory(String(raw.categoryRaw ?? ""));
  if (catRaw) {
    return result(catRaw, "CATEGORY_RAW", "MEDIUM", [`categoryRaw:${raw.categoryRaw}`]);
  }

  const calcCat = matchCalcMode(raw.tradeCalcMode);
  if (calcCat) {
    return result(calcCat, "TRADE_CALC_MODE", "MEDIUM", [`tradeCalcMode:${raw.tradeCalcMode}`]);
  }

  // Contract hint: large contract + forex-like currencies without path still not enough for FOREX.
  if (
    raw.contractSize === 100000 &&
    raw.currencyBase &&
    raw.currencyProfit &&
    raw.currencyBase !== raw.currencyProfit &&
    String(raw.currencyBase).length === 3 &&
    String(raw.currencyProfit).length === 3
  ) {
    // Still require description support or leave unclassified — contract alone is weak.
    const descCat = matchTextCategory(String(raw.description ?? ""));
    if (descCat === "FOREX") {
      return result("FOREX", "CONTRACT", "LOW", [
        `contractSize:${raw.contractSize}`,
        `description:${raw.description}`,
      ]);
    }
  }

  const descCat = matchTextCategory(String(raw.description ?? ""));
  if (descCat) {
    return result(descCat, "DESCRIPTION", "LOW", [`description:${raw.description}`]);
  }

  const nameHit = matchNameHeuristic(raw.symbol);
  if (nameHit) {
    return result(nameHit.category, "NAME_HEURISTIC", "LOW", [nameHit.evidence]);
  }

  return result("UNCLASSIFIED", "UNCLASSIFIED", "NONE", [
    "no_reliable_metadata",
    `symbol:${raw.symbol}`,
  ]);
}

/** Map catalog category → shared MarketAssetType used by provider contracts. */
export function catalogCategoryToMarketType(
  category: HfmCatalogCategory,
): "FOREX" | "COMMODITY" | "INDEX" | "SHARE" | "OTHER" | "UNKNOWN" {
  switch (category) {
    case "FOREX":
      return "FOREX";
    case "METALS":
    case "ENERGIES":
    case "COMMODITIES":
      return "COMMODITY";
    case "INDICES":
      return "INDEX";
    case "SHARES":
      return "SHARE";
    case "OTHER":
      return "OTHER";
    case "UNCLASSIFIED":
    default:
      return "UNKNOWN";
  }
}
