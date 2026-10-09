/**
 * Phase 34 — Normalize ForexConnect.get_history bar rows (bid OHLC).
 * SDK sample fields: Date, BidOpen, BidHigh, BidLow, BidClose, Volume
 */
import type { ForexConnectHistoricalCandle } from "./historical-types.js";
import {
  FOREXCONNECT_TIMEFRAME_MS,
  type ForexConnectSupportedTimeframe,
} from "./timeframes.js";

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function validateOhlc(open: number, high: number, low: number, close: number): boolean {
  if (![open, high, low, close].every((v) => Number.isFinite(v))) return false;
  if (high < low) return false;
  if (high < open || high < close) return false;
  if (low > open || low > close) return false;
  return true;
}

function parseDateToUnixSec(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Already seconds or ms
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const asDate = value instanceof Date
    ? value
    : new Date(String(value));
  const ms = asDate.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.floor(ms / 1000);
}

/**
 * Normalize one ForexConnect history bar.
 * Accepts object rows ({Date, BidOpen, …}) or loose Record from JSON sidecar.
 */
export function normalizeForexConnectHistoryRow(
  row: unknown,
  options?: { nowMs?: number; timeframeMs?: number },
): ForexConnectHistoricalCandle | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  const tsSec = parseDateToUnixSec(
    r.Date ?? r.date ?? r.time ?? r.Time ?? r.timestamp,
  );
  const open = finite(r.BidOpen ?? r.bidOpen ?? r.open);
  const high = finite(r.BidHigh ?? r.bidHigh ?? r.high);
  const low = finite(r.BidLow ?? r.bidLow ?? r.low);
  const close = finite(r.BidClose ?? r.bidClose ?? r.close);
  const volumeRaw = finite(r.Volume ?? r.volume);

  if (
    tsSec == null || tsSec <= 0
    || open == null || high == null || low == null || close == null
  ) {
    return null;
  }
  if (!validateOhlc(open, high, low, close)) return null;

  const nowMs = options?.nowMs ?? Date.now();
  const timeframeMs = options?.timeframeMs ?? 0;
  const openMs = tsSec * 1000;
  const closeMs = timeframeMs > 0 ? openMs + timeframeMs : openMs;
  const closed = timeframeMs > 0 ? closeMs <= nowMs : true;

  // Volume is SDK-supplied tick volume when present; never invent.
  const volume = volumeRaw != null && volumeRaw >= 0 ? volumeRaw : null;

  return {
    time: tsSec,
    open,
    high,
    low,
    close,
    volume,
    closed,
    priceBasis: "bid",
  };
}

export function normalizeForexConnectHistoryRows(
  rows: unknown,
  timeframe: ForexConnectSupportedTimeframe,
  nowMs = Date.now(),
): { candles: ForexConnectHistoricalCandle[]; invalidCandles: number; duplicatesRemoved: number } {
  const list = Array.isArray(rows) ? rows : [];
  const timeframeMs = FOREXCONNECT_TIMEFRAME_MS[timeframe];
  const byTime = new Map<number, ForexConnectHistoricalCandle>();
  let invalidCandles = 0;
  let duplicatesRemoved = 0;

  for (const row of list) {
    const candle = normalizeForexConnectHistoryRow(row, { nowMs, timeframeMs });
    if (!candle) {
      invalidCandles += 1;
      continue;
    }
    if (byTime.has(candle.time)) {
      duplicatesRemoved += 1;
    }
    byTime.set(candle.time, candle);
  }

  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  return { candles, invalidCandles, duplicatesRemoved };
}
