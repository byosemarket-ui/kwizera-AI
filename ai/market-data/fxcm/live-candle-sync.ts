/**
 * Phase 30 — FXCM historical + quote → candle synchronization (pure functions).
 *
 * Price source (documented, matches Phase 28 historical candles):
 *   mid = (bid + ask) / 2
 * One consistent mid basis for open/high/low/close — never mixed bid/ask/mid fields.
 *
 * Rules:
 * - Multiple quotes in one interval → one forming candle
 * - No synthetic candles when time advances without quotes
 * - Closed candles are immutable to ordinary stream events
 * - Deduplicate by candle open timestamp within provider series
 */
import { validateOhlc } from "./historical-normalize.js";
import type { FxcmHistoricalCandle } from "./historical-types.js";
import {
  FXCM_TIMEFRAME_MS,
  type FxcmSupportedProjectTimeframe,
} from "./timeframes.js";
import type { MarketAssetType } from "../providers/types.js";
import type { FxcmLiveCandle } from "./live-candle-types.js";

export const FXCM_CANDLE_PRICE_BASIS = "mid" as const;

export interface FxcmQuotePriceInput {
  bid: number | null;
  ask: number | null;
  mid: number | null;
  /** Event time for bucketing — prefer sourceTimestamp ms, else receivedAt ms. */
  eventTimeMs: number;
}

export interface FxcmCandleIdentityFields {
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  timeframe: FxcmSupportedProjectTimeframe;
}

/** UTC-aligned candle open (epoch seconds) for the given event time. */
export function fxcmCandleBucketStartSec(
  eventTimeMs: number,
  timeframe: FxcmSupportedProjectTimeframe,
): number {
  const intervalMs = FXCM_TIMEFRAME_MS[timeframe];
  if (!Number.isFinite(eventTimeMs) || eventTimeMs <= 0 || !intervalMs) return 0;
  return Math.floor(eventTimeMs / intervalMs) * (intervalMs / 1000);
}

export function fxcmCandleIntervalEndMs(
  openTimeSec: number,
  timeframe: FxcmSupportedProjectTimeframe,
): number {
  return openTimeSec * 1000 + FXCM_TIMEFRAME_MS[timeframe];
}

/** Derive mid price for candle OHLC — requires valid bid+ask (or explicit mid). */
export function fxcmCandlePriceFromQuote(quote: FxcmQuotePriceInput): number | null {
  if (quote.mid != null && Number.isFinite(quote.mid) && quote.mid > 0) {
    if (quote.bid != null && quote.ask != null) {
      if (!(quote.bid > 0 && quote.ask > 0 && quote.bid <= quote.ask)) return null;
    }
    return quote.mid;
  }
  if (
    quote.bid != null && quote.ask != null
    && Number.isFinite(quote.bid) && Number.isFinite(quote.ask)
    && quote.bid > 0 && quote.ask > 0
    && quote.bid <= quote.ask
  ) {
    return (quote.bid + quote.ask) / 2;
  }
  return null;
}

export function historicalToLiveCandle(
  candle: FxcmHistoricalCandle,
  identity: FxcmCandleIdentityFields,
): FxcmLiveCandle {
  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: null,
    tickQty: candle.tickQty,
    closed: candle.closed,
    priceBasis: "mid",
    provider: "FXCM",
    marketType: identity.marketType,
    providerSymbol: identity.providerSymbol,
    canonicalSymbol: identity.canonicalSymbol,
    timeframe: identity.timeframe,
  };
}

export function dedupeSortFxcmLiveCandles(candles: FxcmLiveCandle[]): {
  candles: FxcmLiveCandle[];
  duplicatesRemoved: number;
} {
  const byTime = new Map<number, FxcmLiveCandle>();
  let duplicatesRemoved = 0;
  for (const c of candles) {
    if (!Number.isFinite(c.time) || c.time <= 0) continue;
    if (!validateOhlc(c.open, c.high, c.low, c.close)) continue;
    const existing = byTime.get(c.time);
    if (!existing) {
      byTime.set(c.time, c);
      continue;
    }
    duplicatesRemoved += 1;
    // Prefer closed historical over open when merging same bucket; else keep newer close path via merge rules.
    if (existing.closed && !c.closed) {
      // keep existing closed
    } else if (!existing.closed && c.closed) {
      byTime.set(c.time, c);
    } else {
      // Same closed state: keep the one with later conceptual update (higher high / updated close already baked)
      byTime.set(c.time, {
        ...existing,
        open: existing.open,
        high: Math.max(existing.high, c.high, existing.open, c.close),
        low: Math.min(existing.low, c.low, existing.open, c.close),
        close: c.close,
        closed: existing.closed || c.closed,
        tickQty: c.tickQty ?? existing.tickQty,
      });
    }
  }
  const sorted = [...byTime.values()].sort((a, b) => a.time - b.time);
  return { candles: sorted, duplicatesRemoved };
}

/**
 * Mark forming candles closed when their interval has ended (by canonical clock).
 * Does NOT invent the next candle.
 */
export function closeElapsedFxcmCandles(
  candles: FxcmLiveCandle[],
  nowMs: number,
  timeframe: FxcmSupportedProjectTimeframe,
): FxcmLiveCandle[] {
  return candles.map((c) => {
    if (c.closed) return c;
    const endMs = fxcmCandleIntervalEndMs(c.time, timeframe);
    if (endMs <= nowMs) return { ...c, closed: true };
    return c;
  });
}

/**
 * Apply one valid mid price to a candle series.
 * - Same bucket → update OHLC in place (replace, do not append)
 * - Newer bucket → close previous forming (if any), open new candle
 * - Older bucket on closed candle → ignore (late event)
 * - Older bucket on open candle → ignore if out of order vs series tip
 */
export function applyFxcmPriceToCandles(
  candles: FxcmLiveCandle[],
  price: number,
  eventTimeMs: number,
  identity: FxcmCandleIdentityFields,
  nowMs: number = eventTimeMs,
): { candles: FxcmLiveCandle[]; applied: boolean; reason: string | null } {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(eventTimeMs) || eventTimeMs <= 0) {
    return { candles, applied: false, reason: "invalid_price_or_time" };
  }

  const bucketSec = fxcmCandleBucketStartSec(eventTimeMs, identity.timeframe);
  if (bucketSec <= 0) {
    return { candles, applied: false, reason: "invalid_bucket" };
  }

  let series = closeElapsedFxcmCandles(candles, nowMs, identity.timeframe);
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
    next[idx] = {
      ...existing,
      open,
      high,
      low,
      close,
      closed: false,
      priceBasis: "mid",
    };
    return { candles: next, applied: true, reason: null };
  }

  // New bucket — only create when we have a real price for that interval.
  const tip = series[series.length - 1];
  if (tip && bucketSec < tip.time) {
    return { candles: series, applied: false, reason: "out_of_order_bucket" };
  }

  // Close any still-open prior candles whose interval ended before this event.
  series = series.map((c) => {
    if (c.closed) return c;
    if (fxcmCandleIntervalEndMs(c.time, identity.timeframe) <= eventTimeMs) {
      return { ...c, closed: true };
    }
    return c;
  });

  const formed: FxcmLiveCandle = {
    time: bucketSec,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: null,
    tickQty: null,
    closed: fxcmCandleIntervalEndMs(bucketSec, identity.timeframe) <= nowMs,
    priceBasis: "mid",
    provider: "FXCM",
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

/**
 * Merge historical series with live/forming updates.
 * Historical completed bars are authoritative when both are closed.
 * Live forming wins for the current open bucket.
 */
export function mergeHistoricalWithLiveCandles(
  historical: FxcmLiveCandle[],
  liveSeries: FxcmLiveCandle[],
  nowMs: number,
  timeframe: FxcmSupportedProjectTimeframe,
): { candles: FxcmLiveCandle[]; duplicatesRemoved: number } {
  const histClosed = closeElapsedFxcmCandles(historical, nowMs, timeframe).map((c) =>
    c.closed ? c : { ...c, closed: fxcmCandleIntervalEndMs(c.time, timeframe) <= nowMs },
  );
  const liveClosed = closeElapsedFxcmCandles(liveSeries, nowMs, timeframe);

  const byTime = new Map<number, FxcmLiveCandle>();
  let duplicatesRemoved = 0;

  for (const c of histClosed) {
    byTime.set(c.time, c);
  }
  for (const c of liveClosed) {
    const existing = byTime.get(c.time);
    if (!existing) {
      byTime.set(c.time, c);
      continue;
    }
    duplicatesRemoved += 1;
    if (existing.closed && c.closed) {
      // Historical authoritative for completed bars.
      byTime.set(c.time, existing);
    } else if (!c.closed) {
      // Live forming updates the open bucket; preserve historical open if present.
      byTime.set(c.time, {
        ...c,
        open: existing.open,
        high: Math.max(existing.high, c.high, existing.open, c.close),
        low: Math.min(existing.low, c.low, existing.open, c.close),
        close: c.close,
        closed: false,
      });
    } else {
      byTime.set(c.time, { ...c, closed: true });
    }
  }

  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  return { candles, duplicatesRemoved };
}

export function formingCandleOf(candles: FxcmLiveCandle[]): FxcmLiveCandle | null {
  for (let i = candles.length - 1; i >= 0; i -= 1) {
    const c = candles[i]!;
    if (!c.closed) return c;
  }
  return null;
}
