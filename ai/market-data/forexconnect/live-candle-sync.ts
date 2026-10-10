/**
 * Phase 35 — ForexConnect historical + live bid → forming candles (pure).
 * Price basis: BID only (matches Phase 34 get_history BidOpen/High/Low/Close).
 */
import { validateOhlc } from "./historical-normalize.js";
import type { ForexConnectHistoricalCandle } from "./historical-types.js";
import type { ForexConnectLiveCandle } from "./live-types.js";
import {
  FOREXCONNECT_TIMEFRAME_MS,
  type ForexConnectSupportedTimeframe,
} from "./timeframes.js";
import type { MarketAssetType } from "../providers/types.js";

export const FOREXCONNECT_CANDLE_PRICE_BASIS = "bid" as const;
export const FOREXCONNECT_STALE_MS = 15_000;

export interface ForexConnectCandleIdentity {
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  timeframe: ForexConnectSupportedTimeframe;
}

export function fcCandleBucketStartSec(
  eventTimeMs: number,
  timeframe: ForexConnectSupportedTimeframe,
): number {
  const intervalMs = FOREXCONNECT_TIMEFRAME_MS[timeframe];
  if (!Number.isFinite(eventTimeMs) || eventTimeMs <= 0 || !intervalMs) return 0;
  return Math.floor(eventTimeMs / intervalMs) * (intervalMs / 1000);
}

export function fcCandleIntervalEndMs(
  openTimeSec: number,
  timeframe: ForexConnectSupportedTimeframe,
): number {
  return openTimeSec * 1000 + FOREXCONNECT_TIMEFRAME_MS[timeframe];
}

/** Candle price from quote — bid only; never invent mid for OHLC. */
export function fcCandlePriceFromQuote(bid: number | null | undefined): number | null {
  if (bid == null || !Number.isFinite(bid) || bid <= 0) return null;
  return bid;
}

export function historicalToFcLiveCandle(
  candle: ForexConnectHistoricalCandle,
  identity: ForexConnectCandleIdentity,
): ForexConnectLiveCandle {
  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    closed: candle.closed,
    priceBasis: "bid",
    provider: "FOREXCONNECT",
    marketType: identity.marketType,
    providerSymbol: identity.providerSymbol,
    canonicalSymbol: identity.canonicalSymbol,
    timeframe: identity.timeframe,
  };
}

export function closeElapsedFcCandles(
  candles: ForexConnectLiveCandle[],
  nowMs: number,
  timeframe: ForexConnectSupportedTimeframe,
): ForexConnectLiveCandle[] {
  return candles.map((c) => {
    if (c.closed) return c;
    if (fcCandleIntervalEndMs(c.time, timeframe) <= nowMs) return { ...c, closed: true };
    return c;
  });
}

export function formingCandleOf(
  candles: ForexConnectLiveCandle[],
): ForexConnectLiveCandle | null {
  for (let i = candles.length - 1; i >= 0; i -= 1) {
    const c = candles[i]!;
    if (!c.closed) return c;
  }
  return null;
}

export function applyFcBidPriceToCandles(
  candles: ForexConnectLiveCandle[],
  price: number,
  eventTimeMs: number,
  identity: ForexConnectCandleIdentity,
  nowMs: number = eventTimeMs,
): { candles: ForexConnectLiveCandle[]; applied: boolean; reason: string | null } {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(eventTimeMs) || eventTimeMs <= 0) {
    return { candles, applied: false, reason: "invalid_price_or_time" };
  }

  const bucketSec = fcCandleBucketStartSec(eventTimeMs, identity.timeframe);
  if (bucketSec <= 0) {
    return { candles, applied: false, reason: "invalid_bucket" };
  }

  let series = closeElapsedFcCandles(candles, nowMs, identity.timeframe);
  const idx = series.findIndex((c) => c.time === bucketSec);

  if (idx >= 0) {
    const existing = series[idx]!;
    if (existing.closed) {
      return { candles: series, applied: false, reason: "closed_candle_immutable" };
    }
    const open = existing.open;
    const high = Math.max(existing.high, price, open);
    const low = Math.min(existing.low, price, open);
    const close = price;
    if (!validateOhlc(open, high, low, close)) {
      return { candles: series, applied: false, reason: "invalid_ohlc_update" };
    }
    const next = series.slice();
    next[idx] = { ...existing, open, high, low, close, closed: false, priceBasis: "bid" };
    return { candles: next, applied: true, reason: null };
  }

  const tip = series[series.length - 1];
  if (tip && bucketSec < tip.time) {
    return { candles: series, applied: false, reason: "out_of_order_bucket" };
  }

  series = series.map((c) => {
    if (c.closed) return c;
    if (fcCandleIntervalEndMs(c.time, identity.timeframe) <= eventTimeMs) {
      return { ...c, closed: true };
    }
    return c;
  });

  const formed: ForexConnectLiveCandle = {
    time: bucketSec,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: null,
    closed: fcCandleIntervalEndMs(bucketSec, identity.timeframe) <= nowMs,
    priceBasis: "bid",
    provider: "FOREXCONNECT",
    marketType: identity.marketType,
    providerSymbol: identity.providerSymbol,
    canonicalSymbol: identity.canonicalSymbol,
    timeframe: identity.timeframe,
  };
  if (!validateOhlc(formed.open, formed.high, formed.low, formed.close)) {
    return { candles: series, applied: false, reason: "invalid_new_candle" };
  }
  return { candles: [...series, formed], applied: true, reason: null };
}

export function mergeHistoricalWithFcLiveCandles(
  historical: ForexConnectLiveCandle[],
  liveSeries: ForexConnectLiveCandle[],
  nowMs: number,
  timeframe: ForexConnectSupportedTimeframe,
): ForexConnectLiveCandle[] {
  const hist = closeElapsedFcCandles(historical, nowMs, timeframe).map((c) =>
    c.closed ? c : { ...c, closed: fcCandleIntervalEndMs(c.time, timeframe) <= nowMs },
  );
  const live = closeElapsedFcCandles(liveSeries, nowMs, timeframe);
  const byTime = new Map<number, ForexConnectLiveCandle>();

  for (const c of hist) byTime.set(c.time, c);
  for (const c of live) {
    const existing = byTime.get(c.time);
    if (!existing) {
      byTime.set(c.time, c);
      continue;
    }
    if (existing.closed && c.closed) {
      byTime.set(c.time, existing);
    } else if (!c.closed) {
      byTime.set(c.time, {
        ...c,
        open: existing.open,
        high: Math.max(existing.high, c.high, existing.open, c.close),
        low: Math.min(existing.low, c.low, existing.open, c.close),
        close: c.close,
        closed: false,
        priceBasis: "bid",
      });
    }
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export function normalizeFcOfferQuote(raw: unknown, receivedAtMs = Date.now()): {
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  candlePrice: number | null;
  sourceTimestampMs: number | null;
  receivedAtMs: number;
  offerId: string | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const providerSymbol = String(r.providerSymbol ?? r.instrument ?? r.symbol ?? "").trim();
  if (!providerSymbol) return null;
  const canonicalSymbol = String(
    r.canonicalSymbol ?? providerSymbol.replace(/[/_-\s]/g, ""),
  ).toUpperCase();
  const bidRaw = Number(r.bid);
  const askRaw = Number(r.ask);
  const bid = Number.isFinite(bidRaw) && bidRaw > 0 ? bidRaw : null;
  const ask = Number.isFinite(askRaw) && askRaw > 0 ? askRaw : null;
  const mid = bid != null && ask != null && bid <= ask ? (bid + ask) / 2 : null;
  const candlePrice = fcCandlePriceFromQuote(bid);
  let sourceTimestampMs: number | null = null;
  const ts = r.sourceTimestampMs ?? r.time ?? r.timestamp;
  if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
    sourceTimestampMs = ts > 1e12 ? Math.floor(ts) : Math.floor(ts * 1000);
  } else if (typeof ts === "string" && ts.trim()) {
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) sourceTimestampMs = parsed;
  }
  let resolvedReceivedAtMs = receivedAtMs;
  const rawReceived = r.receivedAtMs ?? r.receivedAt;
  if (typeof rawReceived === "number" && Number.isFinite(rawReceived) && rawReceived > 0) {
    resolvedReceivedAtMs = rawReceived > 1e12
      ? Math.floor(rawReceived)
      : Math.floor(rawReceived * 1000);
  } else if (typeof rawReceived === "string" && rawReceived.trim()) {
    const parsed = Date.parse(rawReceived);
    if (Number.isFinite(parsed)) resolvedReceivedAtMs = parsed;
  }
  return {
    providerSymbol,
    canonicalSymbol,
    displaySymbol: String(r.displaySymbol ?? providerSymbol),
    bid,
    ask,
    mid,
    candlePrice,
    sourceTimestampMs,
    receivedAtMs: resolvedReceivedAtMs,
    offerId: r.offerId != null ? String(r.offerId) : null,
  };
}
