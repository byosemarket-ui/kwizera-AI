/**
 * Phase 29 — FXCM raw price-update → normalized quote event.
 * Official Rates: [Bid, Ask, Session High, Session Low] (docs §4.4).
 * Does not fabricate missing fields; does not build candles.
 */
import type { MarketAssetType } from "../providers/types.js";
import type {
  FxcmMarketQuoteEvent,
  FxcmRawPriceUpdate,
  FxcmStreamState,
} from "./stream-types.js";
import { readFxcmAccessToken } from "./config.js";
import { FxcmMarketDataError } from "./errors.js";

export interface NormalizeFxcmQuoteContext {
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  marketType: MarketAssetType;
  receivedAtMs: number;
  connectionState: FxcmStreamState;
}

function finitePositive(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

/**
 * FXCM Updated may be epoch seconds or milliseconds depending on payload revision.
 * Normalize to epoch milliseconds.
 */
export function normalizeFxcmSourceTimestampMs(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Seconds epoch ~1e9–1e10; ms epoch ~1e12–1e13
  if (n < 1e11) return Math.floor(n * 1000);
  return Math.floor(n);
}

export function parseFxcmPriceUpdatePayload(raw: unknown): FxcmRawPriceUpdate | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parseFxcmPriceUpdatePayload(parsed);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  return raw as FxcmRawPriceUpdate;
}

export interface QuoteValidationResult {
  valid: boolean;
  reason: string | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  sessionHigh: number | null;
  sessionLow: number | null;
}

export function validateFxcmRates(rates: unknown): QuoteValidationResult {
  if (!Array.isArray(rates) || rates.length < 2) {
    return {
      valid: false,
      reason: "Rates array missing Bid/Ask",
      bid: null,
      ask: null,
      mid: null,
      sessionHigh: null,
      sessionLow: null,
    };
  }
  const bid = finitePositive(Number(rates[0]));
  const ask = finitePositive(Number(rates[1]));
  const sessionHigh = rates.length > 2 ? finitePositive(Number(rates[2])) : null;
  const sessionLow = rates.length > 3 ? finitePositive(Number(rates[3])) : null;

  if (bid == null || ask == null) {
    return {
      valid: false,
      reason: "Bid/Ask not finite positive numbers",
      bid,
      ask,
      mid: null,
      sessionHigh,
      sessionLow,
    };
  }
  if (bid > ask) {
    return {
      valid: false,
      reason: "bid > ask",
      bid,
      ask,
      mid: null,
      sessionHigh,
      sessionLow,
    };
  }
  const mid = (bid + ask) / 2;
  if (!Number.isFinite(mid)) {
    return {
      valid: false,
      reason: "mid not finite",
      bid,
      ask,
      mid: null,
      sessionHigh,
      sessionLow,
    };
  }
  return {
    valid: true,
    reason: null,
    bid,
    ask,
    mid,
    sessionHigh,
    sessionLow,
  };
}

/**
 * Normalize one FXCM price event. Invalid events are returned with valid=false
 * (never replaced with synthetic prices).
 */
export function normalizeFxcmPriceUpdate(
  raw: unknown,
  ctx: NormalizeFxcmQuoteContext,
): FxcmMarketQuoteEvent {
  const payload = parseFxcmPriceUpdatePayload(raw);
  const receivedAt = new Date(ctx.receivedAtMs).toISOString();
  const baseInvalid = (reason: string): FxcmMarketQuoteEvent => ({
    provider: "FXCM",
    marketType: ctx.marketType,
    providerSymbol: ctx.providerSymbol,
    canonicalSymbol: ctx.canonicalSymbol,
    displaySymbol: ctx.displaySymbol,
    timestamp: receivedAt,
    sourceTimestamp: null,
    receivedAt,
    bid: null,
    ask: null,
    mid: null,
    last: null,
    bidSize: null,
    askSize: null,
    sessionHigh: null,
    sessionLow: null,
    sequence: null,
    latencyMs: null,
    connectionState: ctx.connectionState,
    dataQuality: "INVALID",
    source: "FXCM",
    valid: false,
    invalidReason: reason,
  });

  if (!payload) return baseInvalid("Malformed FXCM price payload");

  const symbol = String(payload.Symbol ?? "").trim();
  if (symbol && symbol !== ctx.providerSymbol) {
    return baseInvalid(`Symbol mismatch: expected ${ctx.providerSymbol}`);
  }

  const sourceMs = normalizeFxcmSourceTimestampMs(payload.Updated);
  const sourceTimestamp = sourceMs != null ? new Date(sourceMs).toISOString() : null;
  const rates = validateFxcmRates(payload.Rates);
  if (!rates.valid) {
    return {
      ...baseInvalid(rates.reason ?? "Invalid rates"),
      sourceTimestamp,
      bid: rates.bid,
      ask: rates.ask,
      sessionHigh: rates.sessionHigh,
      sessionLow: rates.sessionLow,
    };
  }

  let latencyMs: number | null = null;
  if (sourceMs != null) {
    const lag = ctx.receivedAtMs - sourceMs;
    // Only report latency when source clock is plausible (not far in the future).
    if (Number.isFinite(lag) && lag >= -5_000 && lag < 3_600_000) {
      latencyMs = Math.max(0, Math.floor(lag));
    }
  }

  const timestamp = sourceTimestamp ?? receivedAt;
  return {
    provider: "FXCM",
    marketType: ctx.marketType,
    providerSymbol: ctx.providerSymbol,
    canonicalSymbol: ctx.canonicalSymbol,
    displaySymbol: ctx.displaySymbol,
    timestamp,
    sourceTimestamp,
    receivedAt,
    bid: rates.bid,
    ask: rates.ask,
    mid: rates.mid,
    last: null,
    bidSize: null,
    askSize: null,
    sessionHigh: rates.sessionHigh,
    sessionLow: rates.sessionLow,
    sequence: null,
    latencyMs,
    connectionState: ctx.connectionState,
    dataQuality: "LIVE",
    source: "FXCM",
    valid: true,
    invalidReason: null,
  };
}

/** True when an incoming event is older than the currently accepted source timestamp. */
export function isOutOfOrderQuote(
  incomingSourceMs: number | null,
  currentSourceMs: number | null,
): boolean {
  if (incomingSourceMs == null || currentSourceMs == null) return false;
  return incomingSourceMs < currentSourceMs;
}

export function assertSafeStreamPayload(payload: unknown, token?: string | null): void {
  const text = JSON.stringify(payload);
  const resolved = token === undefined ? readFxcmAccessToken() : token;
  if (resolved && resolved.length >= 8 && text.includes(resolved)) {
    throw new FxcmMarketDataError("FXCM_UNSUPPORTED_OPERATION", "Refusing to expose FXCM credentials.");
  }
  if (/Bearer\s+[A-Za-z0-9+/=._-]{16,}/i.test(text)) {
    throw new FxcmMarketDataError("FXCM_UNSUPPORTED_OPERATION", "Refusing to expose FXCM authorization header.");
  }
  if (/access_token=/i.test(text)) {
    throw new FxcmMarketDataError("FXCM_UNSUPPORTED_OPERATION", "Refusing to expose FXCM access_token.");
  }
}
