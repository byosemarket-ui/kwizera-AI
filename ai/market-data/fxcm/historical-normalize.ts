/**
 * Phase 28 — Normalize + validate official FXCM candle rows.
 * Format: [timestampSec, BidOpen, BidClose, BidHigh, BidLow, AskOpen, AskClose, AskHigh, AskLow, TickQty]
 * Prices exposed as mid OHLC; tickQty preserved separately (not treated as volume).
 */
import type {
  FxcmHistoricalCandle,
  FxcmHistoricalGap,
  FxcmHistoricalQuality,
} from "./historical-types.js";
import {
  FXCM_TIMEFRAME_MS,
  type FxcmSupportedProjectTimeframe,
} from "./timeframes.js";

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mid(a: number, b: number): number {
  return (a + b) / 2;
}

export function validateOhlc(open: number, high: number, low: number, close: number): boolean {
  if (![open, high, low, close].every((v) => Number.isFinite(v))) return false;
  if (high < low) return false;
  if (high < open || high < close) return false;
  if (low > open || low > close) return false;
  return true;
}

/**
 * Parse one official FXCM candle array into mid OHLC.
 * Returns null when invalid — caller counts invalidCandles (no fabrication).
 */
export function normalizeFxcmCandleRow(
  row: unknown,
  options?: { nowMs?: number; timeframeMs?: number },
): FxcmHistoricalCandle | null {
  if (!Array.isArray(row) || row.length < 9) return null;
  const tsSec = finite(row[0]);
  const bidOpen = finite(row[1]);
  const bidClose = finite(row[2]);
  const bidHigh = finite(row[3]);
  const bidLow = finite(row[4]);
  const askOpen = finite(row[5]);
  const askClose = finite(row[6]);
  const askHigh = finite(row[7]);
  const askLow = finite(row[8]);
  const tickQty = row.length >= 10 ? finite(row[9]) : null;

  if (
    tsSec == null || tsSec <= 0
    || bidOpen == null || bidClose == null || bidHigh == null || bidLow == null
    || askOpen == null || askClose == null || askHigh == null || askLow == null
  ) {
    return null;
  }

  const open = mid(bidOpen, askOpen);
  const close = mid(bidClose, askClose);
  const high = mid(bidHigh, askHigh);
  const low = mid(bidLow, askLow);
  if (!validateOhlc(open, high, low, close)) return null;

  const nowMs = options?.nowMs ?? Date.now();
  const timeframeMs = options?.timeframeMs ?? 0;
  const openMs = Math.floor(tsSec) * 1000;
  const closeMs = timeframeMs > 0 ? openMs + timeframeMs : openMs;
  const closed = timeframeMs > 0 ? closeMs <= nowMs : true;

  return {
    time: Math.floor(tsSec),
    open,
    high,
    low,
    close,
    volume: null,
    tickQty,
    closed,
    priceBasis: "mid",
  };
}

export function normalizeFxcmCandleRows(
  rows: unknown,
  timeframe: FxcmSupportedProjectTimeframe,
  nowMs = Date.now(),
): { candles: FxcmHistoricalCandle[]; invalidCandles: number; duplicatesRemoved: number } {
  const list = Array.isArray(rows) ? rows : [];
  const timeframeMs = FXCM_TIMEFRAME_MS[timeframe];
  const byTime = new Map<number, FxcmHistoricalCandle>();
  let invalidCandles = 0;
  let duplicatesRemoved = 0;

  for (const row of list) {
    const candle = normalizeFxcmCandleRow(row, { nowMs, timeframeMs });
    if (!candle) {
      invalidCandles += 1;
      continue;
    }
    if (byTime.has(candle.time)) {
      duplicatesRemoved += 1;
      continue;
    }
    byTime.set(candle.time, candle);
  }

  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  return { candles, invalidCandles, duplicatesRemoved };
}

/**
 * Gap detection between consecutive candles.
 * Weekend-sized gaps on intraday FX are labeled EXPECTED_SESSION_GAP (no invented calendar).
 * Smaller unexpected skips → UNEXPECTED_DATA_GAP. Never fill gaps.
 */
export function detectFxcmCandleGaps(
  candles: FxcmHistoricalCandle[],
  timeframe: FxcmSupportedProjectTimeframe,
): FxcmHistoricalGap[] {
  if (candles.length < 2) return [];
  const intervalMs = FXCM_TIMEFRAME_MS[timeframe];
  const gaps: FxcmHistoricalGap[] = [];
  // Weekend-ish threshold for intraday: > ~48h of missing intervals
  const weekendMs = 48 * 60 * 60 * 1000;

  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1]!;
    const curr = candles[i]!;
    const deltaMs = (curr.time - prev.time) * 1000;
    if (deltaMs <= intervalMs * 1.5) continue;
    const missing = Math.max(0, Math.round(deltaMs / intervalMs) - 1);
    if (missing <= 0) continue;
    const kind: FxcmHistoricalGap["kind"] =
      intervalMs < 24 * 60 * 60 * 1000 && deltaMs >= weekendMs
        ? "EXPECTED_SESSION_GAP"
        : "UNEXPECTED_DATA_GAP";
    gaps.push({
      kind,
      gapStart: new Date(prev.time * 1000).toISOString(),
      gapEnd: new Date(curr.time * 1000).toISOString(),
      expectedIntervalMs: intervalMs,
      missingCandlesEstimate: missing,
    });
  }
  return gaps;
}

export function buildHistoricalQuality(input: {
  candles: FxcmHistoricalCandle[];
  invalidCandles: number;
  duplicatesRemoved: number;
  gaps: FxcmHistoricalGap[];
  source: "FXCM" | "CACHE";
}): FxcmHistoricalQuality {
  const { candles, invalidCandles, duplicatesRemoved, gaps, source } = input;
  let status: FxcmHistoricalQuality["status"] = "VALID";
  if (candles.length === 0) {
    status = invalidCandles > 0 ? "INVALID" : "NO_DATA";
  } else if (invalidCandles > 0 || gaps.some((g) => g.kind === "UNEXPECTED_DATA_GAP")) {
    status = "PARTIAL";
  }
  return {
    status,
    candleCount: candles.length,
    firstTimestamp: candles[0] ? new Date(candles[0].time * 1000).toISOString() : null,
    lastTimestamp: candles.length
      ? new Date(candles[candles.length - 1]!.time * 1000).toISOString()
      : null,
    duplicatesRemoved,
    invalidCandles,
    gaps,
    source,
    providerSource: "FXCM",
    mode: "HISTORICAL",
  };
}

export function assertSafeHistoricalPayload(payload: unknown, accessToken: string | null): void {
  const json = JSON.stringify(payload);
  if (accessToken && accessToken.length >= 8 && json.includes(accessToken)) {
    throw new Error("FXCM historical payload leaked access token.");
  }
  if (/Bearer\s+[A-Za-z0-9_-]{8,}/i.test(json)) {
    throw new Error("FXCM historical payload leaked Bearer token.");
  }
  if (/"authorizationHeader"\s*:/i.test(json) || /"accessToken"\s*:/i.test(json) || /"password"\s*:/i.test(json)) {
    throw new Error("FXCM historical payload leaked credential fields.");
  }
}
