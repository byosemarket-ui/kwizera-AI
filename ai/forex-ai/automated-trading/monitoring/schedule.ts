/**
 * Phase 53.1 / 53.3 / 4.18F.8 — Wall-clock 5-minute schedule + candle helpers + dedupe.
 * Analysis cycles fire on UTC :00/:05/…/:55 boundaries (server-side).
 * Candle helpers remain for evidence quality; they do not drive the schedule.
 */
import type { AtMonitorTimeframe } from "./timeframes.js";
import { candleCloseTimeSec, isCandleClosed } from "./timeframes.js";

export type AtAnalysisTrigger = "scheduled" | "manual";

export interface ClosedCandleSignal {
  openTimeSec: number;
  closeTimeSec: number;
  closed: true;
}

/** Fixed recurring analysis interval — UTC five-minute wall clock. */
export const AT_ANALYSIS_SCHEDULE_INTERVAL_MS = 300_000;
export const AT_ANALYSIS_SCHEDULE_INTERVAL_SEC = 300;
/** Start a cycle only within this window after the boundary (no stale backlog). */
export const AT_ANALYSIS_SCHEDULE_SLOT_GRACE_MS = 90_000;
/** Default analysis primary timeframe aligned with the 5-minute schedule. */
export const AT_ANALYSIS_DEFAULT_TIMEFRAME: AtMonitorTimeframe = "5m";

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

/** Floor unix-ms to the current UTC five-minute boundary (seconds). */
export function fiveMinuteBoundarySec(nowMs: number = Date.now()): number {
  const sec = Math.floor(nowMs / 1000);
  return Math.floor(sec / AT_ANALYSIS_SCHEDULE_INTERVAL_SEC) * AT_ANALYSIS_SCHEDULE_INTERVAL_SEC;
}

/** Next UTC five-minute boundary as ISO string (always the upcoming boundary after `now`). */
export function nextFiveMinuteBoundaryUtc(nowMs: number = Date.now()): string {
  const cur = fiveMinuteBoundarySec(nowMs);
  const nowSec = Math.floor(nowMs / 1000);
  // On an exact boundary, "next" is one interval ahead (current slot is the active one).
  const nextSec =
    nowSec === cur
      ? cur + AT_ANALYSIS_SCHEDULE_INTERVAL_SEC
      : cur + AT_ANALYSIS_SCHEDULE_INTERVAL_SEC;
  return new Date(nextSec * 1000).toISOString();
}

export type FiveMinuteSlotDecision =
  | { action: "run"; slotSec: number; scheduledAtUtc: string; delayed: boolean; ageInSlotMs: number }
  | { action: "wait"; slotSec: number; nextAtUtc: string; ageInSlotMs: number }
  | { action: "missed"; slotSec: number; scheduledAtUtc: string; ageInSlotMs: number }
  | { action: "done"; slotSec: number; nextAtUtc: string; ageInSlotMs: number };

/**
 * Decide whether the current UTC five-minute slot should run, wait, or be marked missed.
 * `lastCompletedSlotSec` is the last slot that was either completed or explicitly skipped/missed.
 */
export function decideFiveMinuteSlot(input: {
  nowMs?: number;
  lastCompletedSlotSec: number | null;
}): FiveMinuteSlotDecision {
  const nowMs = input.nowMs ?? Date.now();
  const slotSec = fiveMinuteBoundarySec(nowMs);
  const ageInSlotMs = Math.max(0, nowMs - slotSec * 1000);
  const scheduledAtUtc = new Date(slotSec * 1000).toISOString();
  const nextAtUtc = nextFiveMinuteBoundaryUtc(nowMs);

  if (input.lastCompletedSlotSec != null && slotSec <= input.lastCompletedSlotSec) {
    return { action: "done", slotSec, nextAtUtc, ageInSlotMs };
  }
  if (ageInSlotMs > AT_ANALYSIS_SCHEDULE_SLOT_GRACE_MS) {
    return { action: "missed", slotSec, scheduledAtUtc, ageInSlotMs };
  }
  // Eligible from the boundary; mark delayed when start slips past 15s.
  return {
    action: "run",
    slotSec,
    scheduledAtUtc,
    delayed: ageInSlotMs > 15_000,
    ageInSlotMs,
  };
}

/** Stable key for one scheduled analysis per UTC five-minute slot. */
export function scheduledSlotDedupeKey(input: {
  environment: string;
  instrument: string;
  timeframe: string;
  slotSec: number;
  configEpoch: number;
}): string {
  return [
    input.environment,
    input.instrument.toUpperCase(),
    input.timeframe,
    `slot:${input.slotSec}`,
    String(input.configEpoch),
  ].join("|");
}

/** @deprecated Prefer scheduledSlotDedupeKey for wall-clock schedule. Kept for candle tests. */
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
export const AT_MONITOR_DEFAULT_POLL_MS = 15_000;
export const AT_MONITOR_MAX_POLL_MS = 120_000;
export const AT_MONITOR_ANALYSIS_COOLDOWN_MS = 20_000;
export const AT_MONITOR_MAX_RETRIES = 2;
export const AT_MONITOR_RETRY_BACKOFF_MS = 15_000;

export function clampPollIntervalMs(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : AT_MONITOR_DEFAULT_POLL_MS;
  return Math.max(AT_MONITOR_MIN_INTERVAL_MS, Math.min(AT_MONITOR_MAX_POLL_MS, Math.floor(n)));
}
