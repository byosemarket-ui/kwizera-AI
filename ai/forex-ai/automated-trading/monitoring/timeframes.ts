/**
 * Phase 53.1 — Automated Trading monitoring timeframes.
 * Only ForexConnect-supported project IDs (exact 1:1 mappings).
 * H2 exists in FXCM REST periods but is NOT mapped in ForexConnect project timeframes.
 */
import {
  FOREXCONNECT_TIMEFRAME_MS,
  isForexConnectSupportedTimeframe,
  type ForexConnectSupportedTimeframe,
} from "../../../market-data/forexconnect/timeframes.js";

/** User-facing monitoring timeframes (verified FC mappings only). */
export const AT_MONITOR_TIMEFRAMES = ["5m", "15m", "30m", "1h"] as const;

export type AtMonitorTimeframe = (typeof AT_MONITOR_TIMEFRAMES)[number];

export const AT_MONITOR_TIMEFRAME_LABELS: Record<AtMonitorTimeframe, string> = {
  "5m": "M5",
  "15m": "M15",
  "30m": "M30",
  "1h": "H1",
};

/** Explicitly unsupported for AT monitoring (not inventing FC identifiers). */
export const AT_MONITOR_UNSUPPORTED_REQUESTED = ["H2", "2h", "h2"] as const;

export function isAtMonitorTimeframe(value: unknown): value is AtMonitorTimeframe {
  return (AT_MONITOR_TIMEFRAMES as readonly string[]).includes(String(value ?? "").trim());
}

export function parseAtMonitorTimeframe(value: unknown): AtMonitorTimeframe | null {
  const raw = String(value ?? "").trim();
  if (isAtMonitorTimeframe(raw)) return raw;
  const aliases: Record<string, AtMonitorTimeframe> = {
    m5: "5m",
    M5: "5m",
    m15: "15m",
    M15: "15m",
    m30: "30m",
    M30: "30m",
    H1: "1h",
    h1: "1h",
  };
  return aliases[raw] ?? null;
}

export function atMonitorTimeframeMs(tf: AtMonitorTimeframe): number {
  return FOREXCONNECT_TIMEFRAME_MS[tf];
}

export function assertFcProjectTimeframe(tf: string): ForexConnectSupportedTimeframe | null {
  return isForexConnectSupportedTimeframe(tf) ? tf : null;
}

/**
 * Candle open times are Unix seconds. A candle that opened at `openTimeSec`
 * closes at openTimeSec + periodSec. Incomplete = now < close.
 */
export function candleCloseTimeSec(openTimeSec: number, timeframe: AtMonitorTimeframe): number {
  return openTimeSec + Math.floor(atMonitorTimeframeMs(timeframe) / 1000);
}

export function isCandleClosed(
  openTimeSec: number,
  timeframe: AtMonitorTimeframe,
  nowMs: number = Date.now(),
): boolean {
  const closeSec = candleCloseTimeSec(openTimeSec, timeframe);
  return Math.floor(nowMs / 1000) >= closeSec;
}

/** Floor timestamp to candle open boundary (UTC). */
export function candleOpenBoundarySec(unixSec: number, timeframe: AtMonitorTimeframe): number {
  const period = Math.floor(atMonitorTimeframeMs(timeframe) / 1000);
  return Math.floor(unixSec / period) * period;
}

export function nextCandleCloseUtc(
  timeframe: AtMonitorTimeframe,
  nowMs: number = Date.now(),
): string {
  const nowSec = Math.floor(nowMs / 1000);
  const open = candleOpenBoundarySec(nowSec, timeframe);
  const close = candleCloseTimeSec(open, timeframe);
  // If we're exactly on a boundary, next close is one period ahead.
  const nextClose = nowSec >= close ? close + Math.floor(atMonitorTimeframeMs(timeframe) / 1000) : close;
  return new Date(nextClose * 1000).toISOString();
}
