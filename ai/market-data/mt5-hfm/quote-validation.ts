/**
 * STEP 2A — deterministic HFM quote validation + spread calculation.
 */
import type { HfmCatalogInstrument } from "./catalog-types.js";
import {
  HFM_QUOTE_ENVIRONMENT,
  HFM_QUOTE_PROVIDER,
  type HfmCanonicalQuote,
  type HfmQuoteStatus,
  type HfmQuoteValidationResult,
} from "./quote-types.js";

const PRICE_EPS = 1e-12;

export interface HfmRawQuoteInput {
  symbol?: unknown;
  bid?: unknown;
  ask?: unknown;
  last?: unknown;
  spread?: unknown;
  brokerSpreadPoints?: unknown;
  digits?: unknown;
  point?: unknown;
  tickSize?: unknown;
  tickVolume?: unknown;
  realVolume?: unknown;
  tickFlags?: unknown;
  tickTime?: unknown;
  tickTimeMs?: unknown;
  time_msc?: unknown;
  acquisitionMethod?: unknown;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length ? s : null;
}

export function calculateSpreadPrice(
  bid: number | null,
  ask: number | null,
  digits?: number | null,
): number | null {
  if (bid == null || ask == null) return null;
  if (!(bid > 0) || !(ask > 0)) return null;
  const raw = ask - bid;
  // Round to instrument digits (or 10 dp fallback) to avoid binary float artifacts
  // such as 0.3400000000001455 in UI/canonical quote payloads.
  const d =
    typeof digits === "number" && Number.isInteger(digits) && digits >= 0 && digits <= 12
      ? digits
      : 10;
  const factor = 10 ** d;
  return Math.round(raw * factor) / factor;
}

export function calculateSpreadPoints(
  bid: number | null,
  ask: number | null,
  point: number | null,
): number | null {
  const spread = calculateSpreadPrice(bid, ask);
  if (spread == null || point == null || !(point > 0)) return null;
  return spread / point;
}

function precisionOk(price: number, digits: number | null): boolean {
  if (digits == null || !Number.isInteger(digits) || digits < 0 || digits > 12) return true;
  const scaled = price * 10 ** digits;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

function tickAligned(price: number, tickSize: number | null): boolean {
  if (tickSize == null || !(tickSize > 0)) return true;
  const n = price / tickSize;
  return Math.abs(n - Math.round(n)) < 1e-6;
}

export function validateHfmRawQuote(
  raw: HfmRawQuoteInput,
  opts: {
    receivedAt: string;
    server: string | null;
    sequence: number | null;
    catalogBySymbol: Map<string, HfmCatalogInstrument> | null;
    requireCatalogMatch: boolean;
    provider?: string | null;
    environment?: string | null;
  },
): { quote: HfmCanonicalQuote; accepted: boolean } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const provider = String(opts.provider ?? HFM_QUOTE_PROVIDER);
  const environment = String(opts.environment ?? HFM_QUOTE_ENVIRONMENT);
  if (provider !== HFM_QUOTE_PROVIDER) errors.push("PROVIDER_MISMATCH");
  if (environment !== HFM_QUOTE_ENVIRONMENT) errors.push("ENVIRONMENT_MISMATCH");

  const symbol = asNullableString(raw.symbol);
  if (!symbol) errors.push("SYMBOL_MISSING");

  let catalog: HfmCatalogInstrument | null = null;
  let catalogMatched = false;
  if (symbol && opts.catalogBySymbol) {
    catalog =
      opts.catalogBySymbol.get(symbol) ??
      opts.catalogBySymbol.get(symbol.toUpperCase()) ??
      null;
    if (catalog && catalog.symbol === symbol) {
      catalogMatched = true;
    } else if (catalog && catalog.symbol.toUpperCase() === symbol.toUpperCase()) {
      catalogMatched = true;
      warnings.push("SYMBOL_CASE_NORMALIZED_TO_CATALOG");
    } else if (opts.requireCatalogMatch) {
      errors.push("SYMBOL_NOT_IN_CATALOG");
    } else {
      warnings.push("CATALOG_UNAVAILABLE_OR_MISS");
    }
  } else if (opts.requireCatalogMatch) {
    errors.push("CATALOG_UNAVAILABLE");
  }

  const exactSymbol = catalog?.symbol ?? symbol ?? "";

  if (typeof raw.bid === "number" && !Number.isFinite(raw.bid)) errors.push("BID_NAN");
  if (typeof raw.ask === "number" && !Number.isFinite(raw.ask)) errors.push("ASK_NAN");
  if (typeof raw.last === "number" && !Number.isFinite(raw.last)) errors.push("LAST_NAN");

  const bid = asFiniteNumber(raw.bid);
  const ask = asFiniteNumber(raw.ask);
  const last = asFiniteNumber(raw.last);
  const digits = asFiniteNumber(raw.digits) ?? catalog?.digits ?? null;
  const point = asFiniteNumber(raw.point) ?? catalog?.point ?? null;
  const tickSize = asFiniteNumber(raw.tickSize) ?? catalog?.tickSize ?? null;
  const tickVolume = asFiniteNumber(raw.tickVolume);
  const realVolume = asFiniteNumber(raw.realVolume);
  const tickFlags = asFiniteNumber(raw.tickFlags);
  const quoteTimestamp = asFiniteNumber(raw.tickTime);
  const quoteTimestampMs =
    asFiniteNumber(raw.tickTimeMs) ?? asFiniteNumber(raw.time_msc);
  const brokerSpreadPoints =
    asFiniteNumber(raw.brokerSpreadPoints) ??
    (typeof raw.spread === "number" && Number.isInteger(raw.spread) && raw.spread >= 1
      ? raw.spread
      : null);

  if (bid != null && bid < 0) errors.push("BID_NEGATIVE");
  if (ask != null && ask < 0) errors.push("ASK_NEGATIVE");

  const hasBid = bid != null && bid > 0;
  const hasAsk = ask != null && ask > 0;

  if (!hasBid && !hasAsk) {
    errors.push("NO_BID_ASK");
  } else if (!hasBid || !hasAsk) {
    warnings.push("ONE_SIDED_QUOTE");
  }

  if (hasBid && hasAsk && ask! + PRICE_EPS < bid!) {
    errors.push("ASK_BELOW_BID");
  }

  if (hasBid && digits != null && !precisionOk(bid!, digits)) warnings.push("BID_DIGITS_MISMATCH");
  if (hasAsk && digits != null && !precisionOk(ask!, digits)) warnings.push("ASK_DIGITS_MISMATCH");
  if (hasBid && !tickAligned(bid!, tickSize)) warnings.push("BID_TICK_SIZE_MISMATCH");
  if (hasAsk && !tickAligned(ask!, tickSize)) warnings.push("ASK_TICK_SIZE_MISMATCH");

  if (catalog) {
    if (digits != null && catalog.digits != null && digits !== catalog.digits) {
      warnings.push("DIGITS_METADATA_MISMATCH");
    }
    if (
      point != null &&
      catalog.point != null &&
      Math.abs(point - catalog.point) > Math.max(catalog.point * 1e-9, 1e-15)
    ) {
      warnings.push("POINT_METADATA_MISMATCH");
    }
  }

  const spread = calculateSpreadPrice(hasBid ? bid : null, hasAsk ? ask : null, digits);
  const spreadPoints = calculateSpreadPoints(hasBid ? bid : null, hasAsk ? ask : null, point);

  if (
    spreadPoints != null &&
    brokerSpreadPoints != null &&
    Math.abs(spreadPoints - brokerSpreadPoints) > 1.5
  ) {
    warnings.push("BROKER_SPREAD_MISMATCH");
  }

  // Reject invented zero spread from missing sides: MQL may emit 0 when ask/bid invalid.
  const rawSpreadPrice = asFiniteNumber(raw.spread);
  if (
    rawSpreadPrice != null &&
    spread != null &&
    Math.abs(rawSpreadPrice - spread) > Math.max(Math.abs(spread) * 1e-6, 1e-10) &&
    !(Number.isInteger(rawSpreadPrice) && rawSpreadPrice >= 1)
  ) {
    warnings.push("PAYLOAD_SPREAD_MISMATCH");
  }

  if (quoteTimestamp != null) {
    const receivedMs = Date.parse(opts.receivedAt);
    const nowSec = Number.isFinite(receivedMs) ? receivedMs / 1000 : Date.now() / 1000;
    // MT5 MqlTick.time is broker-server time as unix seconds. HFM Demo commonly
    // runs UTC+2 (or similar), so tick.time can appear hours ahead of VPS UTC
    // without being invalid. Soft-warn within a timezone window; hard-reject
    // only absurd futures that cannot be broker TZ skew.
    const FUTURE_SKEW_WARN_SEC = 12 * 3600;
    const FUTURE_SKEW_REJECT_SEC = 36 * 3600;
    const ahead = quoteTimestamp - nowSec;
    if (ahead > FUTURE_SKEW_REJECT_SEC) errors.push("FUTURE_TIMESTAMP");
    else if (ahead > FUTURE_SKEW_WARN_SEC) warnings.push("FUTURE_TIMESTAMP_SKEW");
    else if (ahead > 300) warnings.push("BROKER_TIME_AHEAD_OF_UTC");
    if (quoteTimestamp < 0) errors.push("INVALID_TIMESTAMP");
  }

  let verdict: HfmQuoteValidationResult["verdict"] = "ok";
  let status: HfmQuoteStatus = "LIVE";
  let accepted = true;

  if (errors.includes("NO_BID_ASK")) {
    verdict = "rejected";
    status = "NO_QUOTE";
    accepted = false;
  } else if (errors.length > 0) {
    verdict = "rejected";
    status = "INVALID";
    accepted = false;
  } else if (warnings.includes("ONE_SIDED_QUOTE")) {
    verdict = "partial";
    status = "INCOMPLETE";
    accepted = true;
  } else if (warnings.length > 0) {
    verdict = "warning";
    status = "LIVE";
    accepted = true;
  }

  const acquisitionMethod =
    raw.acquisitionMethod === "SymbolInfoTick" || raw.acquisitionMethod === "SymbolInfoDouble"
      ? raw.acquisitionMethod
      : "unknown";

  const quote: HfmCanonicalQuote = {
    provider: HFM_QUOTE_PROVIDER,
    environment: HFM_QUOTE_ENVIRONMENT,
    server: opts.server,
    symbol: exactSymbol,
    bid: hasBid ? bid : null,
    ask: hasAsk ? ask : null,
    last: last != null && Number.isFinite(last) ? last : null,
    spread: accepted && hasBid && hasAsk ? spread : null,
    spreadPoints: accepted && hasBid && hasAsk ? spreadPoints : null,
    brokerSpreadPoints,
    digits,
    point,
    tickSize,
    tickVolume,
    realVolume,
    tickFlags,
    quoteTimestamp,
    quoteTimestampMs,
    receivedAt: opts.receivedAt,
    sequence: opts.sequence,
    status,
    validation: {
      verdict,
      errors,
      warnings,
      catalogMatched,
      catalogVersion: catalog?.catalogVersion ?? null,
    },
    source: "mql5_readonly_snapshot",
    acquisitionMethod,
    previousStatus: null,
    statusReason: errors[0] ?? warnings[0] ?? null,
    statusChangedAt: opts.receivedAt,
    mutatesBroker: false,
    placesOrders: false,
    acceptsForExecution: false,
  };

  return { quote, accepted };
}
