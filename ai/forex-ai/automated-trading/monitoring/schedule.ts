/**
 * Phase 53.1 / 53.3 — Candle-close scheduling & analysis job dedupe.
 */
import type { AtMonitorTimeframe } from "./timeframes.js";
import { candleCloseTimeSec, isCandleClosed } from "./timeframes.js";

export type AtAnalysisTrigger = "scheduled" | "manual";

export interface ClosedCandleSignal {
  openTimeSec: number;
  closeTimeSec: number;
  closed: true;
}

/**
 * From a chronological candle list (open times ascending), return the newest
 * fully closed candle open time, or null if none closed yet.
 */
export function latestClosedCandleOpenSec(
  openTimesSec: number[],
  timeframe: AtMonitorTimeframe,
  nowMs: number = Date.now(),
): ClosedCandleSignal | null {
  let best: ClosedCandleSignal | null = null;
  for (const open of openTimesSec) {
    if (!Number.isFinite(open)) continue;
    if (!isCandleClosed(open, timeframe, nowMs)) continue;
    const closeTimeSec = candleCloseTimeSec(open, timeframe);
    if (!best || open > best.openTimeSec) {
      best = { openTimeSec: open, closeTimeSec, closed: true };
    }
  }
  return best;
}

/** Stable key for one scheduled analysis per closed candle. */
export function scheduledAnalysisDedupeKey(input: {
  environment: string;
  instrument: string;
  timeframe: string;
  closedCandleOpenSec: number;
  configEpoch: number;
}): string {
  return [
    input.environment,
    input.instrument.toUpperCase(),
    input.timeframe,
    String(input.closedCandleOpenSec),
    String(input.configEpoch),
  ].join("|");
}

export const AT_MONITOR_MIN_INTERVAL_MS = 15_000;
export const AT_MONITOR_DEFAULT_POLL_MS = 20_000;
export const AT_MONITOR_MAX_POLL_MS = 120_000;
export const AT_MONITOR_ANALYSIS_COOLDOWN_MS = 30_000;
export const AT_MONITOR_MAX_RETRIES = 2;
export const AT_MONITOR_RETRY_BACKOFF_MS = 15_000;

export function clampPollIntervalMs(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : AT_MONITOR_DEFAULT_POLL_MS;
  return Math.max(AT_MONITOR_MIN_INTERVAL_MS, Math.min(AT_MONITOR_MAX_POLL_MS, Math.floor(n)));
}
