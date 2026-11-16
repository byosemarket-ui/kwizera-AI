/**
 * STEP 2 — HFM MT5 metadata field-quality + grouped completeness.
 * Distinguishes AVAILABLE / UNAVAILABLE / UNSUPPORTED / ERROR / NOT_APPLICABLE.
 * Never treats legitimate zero as collection failure.
 */
import type { HfmRawCatalogSymbol } from "./catalog-types.js";

export type HfmFieldCollectionStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "UNSUPPORTED"
  | "ERROR"
  | "NOT_APPLICABLE";

export interface HfmFieldQualityEntry {
  field: string;
  status: HfmFieldCollectionStatus;
  valuePresent: boolean;
  errorCode: string | null;
  errorDescription: string | null;
  sourceApi: string;
  retryAppropriate: boolean;
  collectedAt: string;
}

export type HfmMetadataCompletenessGroup =
  | "identity"
  | "currency"
  | "pricePrecision"
  | "contract"
  | "volume"
  | "tradingConfig"
  | "margin"
  | "session"
  | "classification";

export interface HfmMetadataGroupScore {
  group: HfmMetadataCompletenessGroup;
  present: number;
  total: number;
  percent: number;
  missingRequired: string[];
  missingOptional: string[];
}

export interface HfmMetadataQualityReport {
  metadataCompleteness: number;
  metadataCompletenessPercent: number;
  requiredFieldsComplete: boolean;
  optionalFieldsComplete: boolean;
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  fieldQuality: Record<string, HfmFieldQualityEntry>;
  groups: HfmMetadataGroupScore[];
  metadataCollectedAt: string;
  metadataUpdatedAt: string;
}

interface FieldSpec {
  field: keyof HfmRawCatalogSymbol | string;
  group: HfmMetadataCompletenessGroup;
  required: boolean;
  sourceApi: string;
  /** Fields that often are empty on HFM Demo without being errors. */
  emptyIsNotApplicable?: boolean;
  weight?: number;
}

const FIELD_SPECS: FieldSpec[] = [
  { field: "description", group: "identity", required: true, sourceApi: "SymbolInfoString(SYMBOL_DESCRIPTION)" },
  { field: "path", group: "identity", required: true, sourceApi: "SymbolInfoString(SYMBOL_PATH)" },
  { field: "isin", group: "identity", required: false, sourceApi: "SymbolInfoString(SYMBOL_ISIN)", emptyIsNotApplicable: true },
  { field: "categoryRaw", group: "identity", required: false, sourceApi: "SymbolInfoString(SYMBOL_CATEGORY)", emptyIsNotApplicable: true },
  { field: "sector", group: "identity", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_SECTOR)" },
  { field: "industry", group: "identity", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_INDUSTRY)" },
  { field: "customSymbol", group: "identity", required: true, sourceApi: "SymbolExist/SYMBOL_CUSTOM" },
  { field: "selected", group: "identity", required: true, sourceApi: "SymbolInfoInteger(SYMBOL_SELECT)" },
  { field: "visible", group: "identity", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_VISIBLE)" },

  { field: "currencyBase", group: "currency", required: true, sourceApi: "SymbolInfoString(SYMBOL_CURRENCY_BASE)" },
  { field: "currencyProfit", group: "currency", required: true, sourceApi: "SymbolInfoString(SYMBOL_CURRENCY_PROFIT)" },
  { field: "currencyMargin", group: "currency", required: false, sourceApi: "SymbolInfoString(SYMBOL_CURRENCY_MARGIN)" },

  { field: "digits", group: "pricePrecision", required: true, sourceApi: "SymbolInfoInteger(SYMBOL_DIGITS)" },
  { field: "point", group: "pricePrecision", required: true, sourceApi: "SymbolInfoDouble(SYMBOL_POINT)" },
  { field: "tickSize", group: "pricePrecision", required: true, sourceApi: "SymbolInfoDouble(SYMBOL_TRADE_TICK_SIZE)" },
  { field: "tickValue", group: "pricePrecision", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_TRADE_TICK_VALUE)" },
  { field: "tickValueProfit", group: "pricePrecision", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_TRADE_TICK_VALUE_PROFIT)" },
  { field: "tickValueLoss", group: "pricePrecision", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_TRADE_TICK_VALUE_LOSS)" },
  { field: "spread", group: "pricePrecision", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_SPREAD)" },
  { field: "spreadFloat", group: "pricePrecision", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_SPREAD_FLOAT)" },

  { field: "contractSize", group: "contract", required: true, sourceApi: "SymbolInfoDouble(SYMBOL_TRADE_CONTRACT_SIZE)" },
  { field: "tradeCalcMode", group: "contract", required: true, sourceApi: "SymbolInfoInteger(SYMBOL_TRADE_CALC_MODE)" },

  { field: "volumeMin", group: "volume", required: true, sourceApi: "SymbolInfoDouble(SYMBOL_VOLUME_MIN)" },
  { field: "volumeMax", group: "volume", required: true, sourceApi: "SymbolInfoDouble(SYMBOL_VOLUME_MAX)" },
  { field: "volumeStep", group: "volume", required: true, sourceApi: "SymbolInfoDouble(SYMBOL_VOLUME_STEP)" },
  { field: "volumeLimit", group: "volume", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_VOLUME_LIMIT)" },

  { field: "tradeMode", group: "tradingConfig", required: true, sourceApi: "SymbolInfoInteger(SYMBOL_TRADE_MODE)" },
  { field: "orderMode", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_ORDER_MODE)" },
  { field: "executionMode", group: "tradingConfig", required: true, sourceApi: "SymbolInfoInteger(SYMBOL_TRADE_EXEMODE)" },
  { field: "fillingMode", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_FILLING_MODE)" },
  { field: "expirationMode", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_EXPIRATION_MODE)" },
  { field: "stopsLevel", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_TRADE_STOPS_LEVEL)" },
  { field: "freezeLevel", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_TRADE_FREEZE_LEVEL)" },
  { field: "tradeAllowed", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_TRADE_MODE!=DISABLED)" },
  { field: "startTime", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_START_TIME)", emptyIsNotApplicable: true },
  { field: "expirationTime", group: "tradingConfig", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_EXPIRATION_TIME)", emptyIsNotApplicable: true },

  { field: "marginInitial", group: "margin", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_MARGIN_INITIAL)" },
  { field: "marginMaintenance", group: "margin", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_MARGIN_MAINTENANCE)" },
  { field: "marginHedged", group: "margin", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_MARGIN_HEDGED)" },
  { field: "marginHedgedUseLeg", group: "margin", required: false, sourceApi: "SymbolInfoInteger(SYMBOL_MARGIN_HEDGED_USE_LEG)" },
  { field: "liquidityRate", group: "margin", required: false, sourceApi: "SymbolInfoDouble(SYMBOL_TRADE_LIQUIDITY_RATE)" },

  { field: "sessions", group: "session", required: false, sourceApi: "SymbolInfoSessionTrade/Quote" },
  { field: "synchronized", group: "session", required: false, sourceApi: "SymbolIsSynchronized" },
];

function mapErrorToStatus(code: string | null | undefined, emptyIsNotApplicable: boolean | undefined): HfmFieldCollectionStatus {
  if (!code) return "AVAILABLE";
  const c = code.toUpperCase();
  if (c === "NOT_QUERIED" || c === "UNSUPPORTED" || c === "NOT_SUPPORTED") return "UNSUPPORTED";
  if (c === "EMPTY" && emptyIsNotApplicable) return "NOT_APPLICABLE";
  if (c === "EMPTY" || c === "UNAVAILABLE" || c === "NOT_FOUND") return "UNAVAILABLE";
  if (c === "INVALID" || c === "ERROR" || c === "JSON_DECODE_ERROR") return "ERROR";
  return "ERROR";
}

function valuePresent(raw: HfmRawCatalogSymbol, field: string): boolean {
  const val = (raw as Record<string, unknown>)[field];
  if (val === null || val === undefined) return false;
  if (val === "") return false;
  return true;
}

export function buildFieldQuality(
  raw: HfmRawCatalogSymbol,
  collectedAt = new Date().toISOString(),
): Record<string, HfmFieldQualityEntry> {
  const out: Record<string, HfmFieldQualityEntry> = {};
  for (const spec of FIELD_SPECS) {
    const err = raw.fieldErrors?.[spec.field] ?? null;
    const present = valuePresent(raw, spec.field);
    let status: HfmFieldCollectionStatus;
    if (err) {
      status = mapErrorToStatus(err, spec.emptyIsNotApplicable);
    } else if (present) {
      status = "AVAILABLE";
    } else if (spec.emptyIsNotApplicable) {
      status = "NOT_APPLICABLE";
    } else {
      status = "UNAVAILABLE";
    }
    out[spec.field] = {
      field: spec.field,
      status,
      valuePresent: present,
      errorCode: err,
      errorDescription: err,
      sourceApi: spec.sourceApi,
      retryAppropriate: status === "ERROR" || status === "UNAVAILABLE",
      collectedAt,
    };
  }
  // Preserve any unexpected fieldErrors not in FIELD_SPECS.
  for (const [field, code] of Object.entries(raw.fieldErrors ?? {})) {
    if (out[field]) continue;
    out[field] = {
      field,
      status: mapErrorToStatus(code, false),
      valuePresent: valuePresent(raw, field),
      errorCode: code,
      errorDescription: code,
      sourceApi: "unknown",
      retryAppropriate: true,
      collectedAt,
    };
  }
  return out;
}

export function computeMetadataQualityReport(
  raw: HfmRawCatalogSymbol,
  opts?: { classified?: boolean; collectedAt?: string; updatedAt?: string },
): HfmMetadataQualityReport {
  const collectedAt = opts?.collectedAt ?? new Date().toISOString();
  const updatedAt = opts?.updatedAt ?? collectedAt;
  const fieldQuality = buildFieldQuality(raw, collectedAt);

  const missingRequiredFields: string[] = [];
  const missingOptionalFields: string[] = [];
  let weightedPresent = 0;
  let weightedTotal = 0;

  const groupAcc = new Map<
    HfmMetadataCompletenessGroup,
    { present: number; total: number; missingRequired: string[]; missingOptional: string[] }
  >();

  for (const spec of FIELD_SPECS) {
    const weight = spec.weight ?? 1;
    weightedTotal += weight;
    const fq = fieldQuality[spec.field];
    const ok = fq?.status === "AVAILABLE" || fq?.status === "NOT_APPLICABLE";
    if (ok) weightedPresent += weight;
    else if (spec.required) missingRequiredFields.push(spec.field);
    else missingOptionalFields.push(spec.field);

    const g = groupAcc.get(spec.group) ?? {
      present: 0,
      total: 0,
      missingRequired: [],
      missingOptional: [],
    };
    g.total += 1;
    if (ok) g.present += 1;
    else if (spec.required) g.missingRequired.push(spec.field);
    else g.missingOptional.push(spec.field);
    groupAcc.set(spec.group, g);
  }

  // Classification completeness group: scored from enrichment context.
  const classGroup = groupAcc.get("classification") ?? {
    present: 0,
    total: 1,
    missingRequired: [] as string[],
    missingOptional: [] as string[],
  };
  classGroup.total = 1;
  if (opts?.classified) {
    classGroup.present = 1;
  } else {
    classGroup.present = 0;
    classGroup.missingRequired.push("classification");
    missingRequiredFields.push("classification");
  }
  groupAcc.set("classification", classGroup);
  weightedTotal += 1;
  if (opts?.classified) weightedPresent += 1;

  const groups: HfmMetadataGroupScore[] = [...groupAcc.entries()].map(([group, g]) => ({
    group,
    present: g.present,
    total: g.total,
    percent: g.total > 0 ? Math.round((g.present / g.total) * 1000) / 10 : 0,
    missingRequired: g.missingRequired,
    missingOptional: g.missingOptional,
  }));

  const percent = weightedTotal > 0 ? Math.round((weightedPresent / weightedTotal) * 1000) / 10 : 0;

  return {
    metadataCompleteness: percent,
    metadataCompletenessPercent: percent,
    requiredFieldsComplete: missingRequiredFields.length === 0,
    optionalFieldsComplete: missingOptionalFields.length === 0,
    missingRequiredFields,
    missingOptionalFields,
    fieldQuality,
    groups,
    metadataCollectedAt: collectedAt,
    metadataUpdatedAt: updatedAt,
  };
}
