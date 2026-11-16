/**
 * Evidence-based HFM MT5 catalog classification (STEP 2).
 * Path / sector / industry / calc mode first; name heuristics only as last resort.
 */
import type {
  HfmCatalogCategory,
  HfmClassificationConfidence,
  HfmClassificationMethod,
  HfmClassificationResult,
  HfmClassificationStatus,
  HfmRawCatalogSymbol,
} from "./catalog-types.js";

/** Bump when classification rules change so sync re-enriches without full rediscovery. */
export const HFM_CLASSIFIER_VERSION = "2.0.0";

function nowIso(): string {
  return new Date().toISOString();
}

function confidenceBand(score: number): HfmClassificationConfidence {
  if (score >= 0.9) return "HIGH";
  if (score >= 0.7) return "MEDIUM";
  if (score >= 0.4) return "LOW";
  return "NONE";
}

function statusFrom(score: number, category: HfmCatalogCategory): HfmClassificationStatus {
  if (category === "UNCLASSIFIED") return "UNCLASSIFIED";
  if (score >= 0.95) return "CONFIRMED";
  if (score >= 0.8) return "HIGH_CONFIDENCE";
  return "NEEDS_REVIEW";
}

function result(
  category: HfmCatalogCategory,
  method: HfmClassificationMethod,
  score: number,
  evidence: string[],
  opts?: { subcategory?: string | null; warnings?: string[] },
): HfmClassificationResult {
  const classificationConfidence = Math.max(0, Math.min(1, score));
  return {
    category,
    subcategory: opts?.subcategory ?? null,
    classificationStatus: statusFrom(classificationConfidence, category),
    confidence: confidenceBand(classificationConfidence),
    classificationConfidence,
    classificationMethod: method,
    method,
    classificationEvidence: evidence,
    evidence,
    classificationWarnings: opts?.warnings ?? [],
    classifiedAt: nowIso(),
    classifierVersion: HFM_CLASSIFIER_VERSION,
  };
}

function pathTokens(path: string | null | undefined): string {
  return String(path ?? "").toLowerCase().replace(/\\/g, "/");
}

function forexSubcategory(symbol: string, path: string): string | null {
  const p = pathTokens(path);
  const u = symbol.toUpperCase();
  if (/major/.test(p)) return "MAJOR";
  if (/minor|cross/.test(p)) return "MINOR";
  if (/exotic/.test(p)) return "EXOTIC";
  if (/^(EURUSD|GBPUSD|USDJPY|USDCHF|USDCAD|AUDUSD|NZDUSD)/.test(u.replace(/[^A-Z0-9]/g, ""))) {
    return "MAJOR";
  }
  return "PAIR";
}

function matchPathCategory(path: string): {
  category: HfmCatalogCategory;
  subcategory: string | null;
  warnings: string[];
} | null {
  const p = pathTokens(path);
  if (!p) return null;
  if (/(^|\/)(forex|fx|currenc)/.test(p)) {
    return { category: "FOREX", subcategory: null, warnings: [] };
  }
  // HFM nests metals and energies under one root — disambiguate before generic "metal".
  if (/(ukoil|usoil|xtiusd|xbrusd|brent|wti|crude|ngas|natgas|natural\s*gas|(^|\/)oil\b)/.test(p)) {
    return { category: "ENERGIES", subcategory: /spot/.test(p) ? "SPOT" : /futur/.test(p) ? "FUTURES_STYLE" : null, warnings: [] };
  }
  if (/(xau|xag|xpt|xpd|gold|silver|platinum|palladium)/.test(p)) {
    let sub: string | null = null;
    if (/xau|gold/.test(p)) sub = "GOLD";
    else if (/xag|silver/.test(p)) sub = "SILVER";
    else if (/xpt|platinum/.test(p)) sub = "PLATINUM";
    else if (/xpd|palladium/.test(p)) sub = "PALLADIUM";
    return { category: "METALS", subcategory: sub, warnings: [] };
  }
  if (/metals\s*&\s*energies/.test(p) && !/(gold|silver|platinum|palladium|xau|xag|xpt|xpd)/.test(p)) {
    return {
      category: "ENERGIES",
      subcategory: null,
      warnings: ["path_metals_energies_ambiguous_defaulted_energies"],
    };
  }
  if (/(^|\/)(metal)/.test(p)) return { category: "METALS", subcategory: null, warnings: [] };
  if (/(^|\/)(energ)/.test(p)) return { category: "ENERGIES", subcategory: null, warnings: [] };
  if (/(^|\/)(indic|index|indices|cash\s*index)/.test(p)) {
    return { category: "INDICES", subcategory: /cash/.test(p) ? "CASH" : null, warnings: [] };
  }
  if (/(^|\/)(share|stock|equity|equities|cfd.?share)/.test(p)) {
    return { category: "SHARES", subcategory: null, warnings: [] };
  }
  if (/(^|\/)(commodit|soft|agricult|coffee|cocoa|sugar|wheat|corn)/.test(p)) {
    return { category: "COMMODITIES", subcategory: null, warnings: [] };
  }
  if (/(^|\/|#)(crypto|bitcoin|ethereum|btc|eth)/.test(p) || /#crypto/.test(p)) {
    return { category: "CRYPTO", subcategory: null, warnings: [] };
  }
  if (/(^|\/)(etf)/.test(p)) return { category: "ETFS", subcategory: null, warnings: [] };
  if (/(^|\/)(bond|bonds|treasury)/.test(p)) return { category: "BONDS", subcategory: null, warnings: [] };
  if (/(^|\/)(option)/.test(p)) return { category: "OPTIONS", subcategory: null, warnings: [] };
  if (/(^|\/)(future)/.test(p) && !/(forex|fx)/.test(p)) {
    return { category: "FUTURES", subcategory: null, warnings: [] };
  }
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
  if (/\b(crypto|bitcoin|ethereum)\b/.test(t)) return "CRYPTO";
  if (/\betf\b/.test(t)) return "ETFS";
  if (/\bbond\b/.test(t)) return "BONDS";
  return null;
}

/** MT5 ENUM_SYMBOL_CALC_MODE — only map unambiguous modes (CFD≠index). */
function matchCalcMode(mode: number | null | undefined): HfmCatalogCategory | null {
  if (mode == null || !Number.isFinite(mode)) return null;
  // SYMBOL_CALC_MODE_FOREX = 0, FOREX_NO_LEVERAGE = 5
  if (mode === 0 || mode === 5) return "FOREX";
  // SYMBOL_CALC_MODE_CFDINDEX is commonly 3 (not 2). Mode 2 is CFD on many builds.
  if (mode === 3) return "INDICES";
  // Futures / options calc modes (common values) — weak alone.
  if (mode === 4) return "FUTURES";
  return null;
}

/**
 * Name heuristic — deliberately narrow. Never treat 6 letters as Forex by default.
 * Only used when all metadata signals are absent.
 */
function matchNameHeuristic(symbol: string): { category: HfmCatalogCategory; evidence: string; subcategory?: string } | null {
  const u = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!u) return null;
  if (/^(XAU|XAG|XPT|XPD)[A-Z]{3}$/.test(u) || /^(XAU|XAG|XPT|XPD)USD$/.test(u)) {
    const sub = u.startsWith("XAU") ? "GOLD" : u.startsWith("XAG") ? "SILVER" : u.startsWith("XPT") ? "PLATINUM" : "PALLADIUM";
    return { category: "METALS", evidence: `name_metal_code:${symbol}`, subcategory: sub };
  }
  if (/^(USOIL|UKOIL|BRENT|WTI|XTIUSD|XBRUSD|NGAS|NATGAS)/.test(u)) {
    return { category: "ENERGIES", evidence: `name_energy_code:${symbol}` };
  }
  if (/^(US30|US500|USTEC|NAS100|GER40|UK100|JP225|AUS200|FRA40|EU50)/.test(u)) {
    return { category: "INDICES", evidence: `name_index_code:${symbol}` };
  }
  if (/^(BTC|ETH|XRP|LTC|ADA|SOL|DOGE)/.test(u) || /^(BTC|ETH)USD/.test(u)) {
    return { category: "CRYPTO", evidence: `name_crypto_code:${symbol}` };
  }
  return null;
}

function looksLikeForexCurrencies(base: string | null, profit: string | null): boolean {
  if (!base || !profit) return false;
  if (base === profit) return false;
  return String(base).length === 3 && String(profit).length === 3;
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
  const pathHit = matchPathCategory(raw.path ?? "");
  if (pathHit) {
    const subcategory =
      pathHit.category === "FOREX"
        ? forexSubcategory(raw.symbol, raw.path ?? "")
        : pathHit.subcategory;
    const warnings = [...pathHit.warnings];
    // Path contradicts calc mode → warn but keep path priority.
    const calc = matchCalcMode(raw.tradeCalcMode);
    if (calc && calc !== pathHit.category && pathHit.category !== "FUTURES") {
      warnings.push(`calc_mode_conflict:${raw.tradeCalcMode}->${calc}`);
    }
    return result(pathHit.category, "SYMBOL_PATH", 0.98, [`path:${raw.path}`], {
      subcategory,
      warnings,
    });
  }

  const sectorText = `${raw.sectorName ?? ""} ${raw.sector ?? ""}`.trim();
  const sectorCat = matchTextCategory(sectorText) ?? matchTextCategory(String(raw.sectorName ?? ""));
  if (sectorCat) {
    return result(sectorCat, "SECTOR", 0.92, [`sector:${raw.sectorName ?? raw.sector}`]);
  }

  const industryText = `${raw.industryName ?? ""} ${raw.categoryRaw ?? ""}`.trim();
  const industryCat = matchTextCategory(industryText);
  if (industryCat) {
    return result(industryCat, "INDUSTRY", 0.85, [
      `industry:${raw.industryName ?? raw.industry ?? ""}`,
      `categoryRaw:${raw.categoryRaw ?? ""}`,
    ]);
  }

  const catRaw = matchTextCategory(String(raw.categoryRaw ?? ""));
  if (catRaw) {
    return result(catRaw, "CATEGORY_RAW", 0.82, [`categoryRaw:${raw.categoryRaw}`]);
  }

  const calcCat = matchCalcMode(raw.tradeCalcMode);
  if (calcCat === "FOREX" && looksLikeForexCurrencies(raw.currencyBase, raw.currencyProfit)) {
    return result("FOREX", "TRADE_CALC_MODE", 0.88, [
      `tradeCalcMode:${raw.tradeCalcMode}`,
      `currencyBase:${raw.currencyBase}`,
      `currencyProfit:${raw.currencyProfit}`,
    ], { subcategory: forexSubcategory(raw.symbol, "") });
  }
  if (calcCat) {
    return result(calcCat, "TRADE_CALC_MODE", 0.75, [`tradeCalcMode:${raw.tradeCalcMode}`], {
      warnings: calcCat === "FOREX" ? ["forex_calc_without_currency_pair_evidence"] : [],
    });
  }

  if (
    raw.contractSize === 100000 &&
    looksLikeForexCurrencies(raw.currencyBase, raw.currencyProfit)
  ) {
    const descCat = matchTextCategory(String(raw.description ?? ""));
    if (descCat === "FOREX") {
      return result("FOREX", "CONTRACT", 0.55, [
        `contractSize:${raw.contractSize}`,
        `description:${raw.description}`,
      ], {
        subcategory: forexSubcategory(raw.symbol, ""),
        warnings: ["contract_heuristic_requires_description"],
      });
    }
  }

  const descCat = matchTextCategory(String(raw.description ?? ""));
  if (descCat) {
    return result(descCat, "DESCRIPTION", 0.5, [`description:${raw.description}`], {
      warnings: ["description_only"],
    });
  }

  const nameHit = matchNameHeuristic(raw.symbol);
  if (nameHit) {
    return result(nameHit.category, "NAME_HEURISTIC", 0.45, [nameHit.evidence], {
      subcategory: nameHit.subcategory ?? null,
      warnings: ["name_heuristic_last_resort"],
    });
  }

  return result("UNCLASSIFIED", "UNCLASSIFIED", 0, [
    "no_reliable_metadata",
    `symbol:${raw.symbol}`,
  ], { warnings: ["insufficient_broker_metadata"] });
}

/** Map catalog category → shared MarketAssetType used by provider contracts. */
export function catalogCategoryToMarketType(
  category: HfmCatalogCategory,
): "FOREX" | "COMMODITY" | "INDEX" | "SHARE" | "CRYPTO" | "OTHER" | "UNKNOWN" {
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
    case "ETFS":
      return "SHARE";
    case "CRYPTO":
      return "CRYPTO";
    case "BONDS":
    case "FUTURES":
    case "OPTIONS":
    case "OTHER":
      return "OTHER";
    case "UNCLASSIFIED":
    default:
      return "UNKNOWN";
  }
}
