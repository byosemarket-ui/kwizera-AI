/**
 * STEP 1B.1 — HFM market session awareness.
 *
 * Distinguishes market schedule state from feed/terminal connectivity.
 * Session windows come from broker SymbolInfoSessionTrade via the HFM catalog
 * (seconds-from-midnight per day-of-week). Broker-clock freeze
 * (TimeCurrent stalled while TimeGMT advances) is an independent closed signal.
 */

import type { HfmSessionDaySummary, HfmSessionSummary, HfmSessionWindow } from "./catalog-types.js";
import { inferMarketClosed } from "./freshness.js";

export const HFM_MARKET_SESSION_STATES = [
  "MARKET_OPEN",
  "MARKET_CLOSED",
  "TRADING_BREAK",
  "MARKET_HOLIDAY",
  "FEED_UNAVAILABLE",
  "MT5_DISCONNECTED",
  "SESSION_UNKNOWN",
] as const;
export type HfmMarketSessionState = (typeof HFM_MARKET_SESSION_STATES)[number];

/** Default lag: TimeGMT ahead of frozen TimeCurrent ⇒ closed (matches agent). */
export const HFM_BROKER_CLOCK_FREEZE_LAG_SEC = 3600;

export interface HfmMarketSessionClassification {
  state: HfmMarketSessionState;
  reason: string;
  /** True when TimeCurrent appears frozen vs TimeGMT (closed/holiday/weekend). */
  brokerClockFrozen: boolean;
  /** Day-of-week 0..6 in broker clock domain when known. */
  brokerDayOfWeek: number | null;
  /** Seconds from broker midnight when known. */
  brokerSecondsFromMidnight: number | null;
  /** Whether catalog session windows were available for the symbol. */
  scheduleSource: "catalog_sessions" | "broker_clock_freeze" | "connectivity" | "none";
  /** Human/diagnostic detail for observability. */
  detail: string | null;
}

function asFinite(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/** MT5/ENUM_DAY_OF_WEEK: 0=Sunday … 6=Saturday (matches MQL BuildSessionSummary day loop). */
export function brokerDayOfWeekFromBrokerTime(brokerTimeSec: number): number {
  // Use UTC getters on the broker-domain epoch value: same numeric wall fields the
  // broker encoded (not a timezone conversion — brokerTime is already broker-local epoch).
  return new Date(brokerTimeSec * 1000).getUTCDay();
}

export function brokerSecondsFromMidnight(brokerTimeSec: number): number {
  const d = new Date(brokerTimeSec * 1000);
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

function daySummaryFromSessions(
  sessions: HfmSessionSummary | null | undefined,
  day: number,
): HfmSessionDaySummary | null {
  if (!sessions || typeof sessions !== "object") return null;
  const key = String(day);
  const nested = sessions.days?.[key];
  if (nested && typeof nested === "object") return nested;
  const flat = sessions[key];
  if (flat && typeof flat === "object" && ("tradeFrom" in (flat as object) || "tradeWindows" in (flat as object))) {
    return flat as HfmSessionDaySummary;
  }
  return null;
}

function tradeWindowsForDay(day: HfmSessionDaySummary | null): HfmSessionWindow[] {
  if (!day) return [];
  if (Array.isArray(day.tradeWindows) && day.tradeWindows.length > 0) {
    return day.tradeWindows.filter((w) => w && w.toSec > w.fromSec);
  }
  const from = asFinite(day.tradeFrom);
  const to = asFinite(day.tradeTo);
  if (from != null && to != null && to > from) return [{ fromSec: from, toSec: to }];
  return [];
}

export function isWithinTradeWindows(
  secondsFromMidnight: number,
  windows: HfmSessionWindow[],
): boolean {
  for (const w of windows) {
    if (secondsFromMidnight >= w.fromSec && secondsFromMidnight < w.toSec) return true;
  }
  return false;
}

/**
 * Classify market session for one symbol using connectivity, broker-clock freeze,
 * and optional catalog SymbolInfoSessionTrade windows.
 */
export function classifyHfmMarketSession(input: {
  symbol?: string | null;
  terminalRunning: boolean | null | undefined;
  feedAvailable?: boolean | null;
  brokerTime: number | null | undefined;
  gmtTime: number | null | undefined;
  sessions?: HfmSessionSummary | null;
  /** Explicit holiday hint when a calendar source exists (optional). */
  holidayHint?: boolean | null;
  brokerClockFreezeLagSec?: number;
}): HfmMarketSessionClassification {
  const lag = input.brokerClockFreezeLagSec ?? HFM_BROKER_CLOCK_FREEZE_LAG_SEC;

  if (input.terminalRunning === false) {
    return {
      state: "MT5_DISCONNECTED",
      reason: "TERMINAL_NOT_RUNNING",
      brokerClockFrozen: false,
      brokerDayOfWeek: null,
      brokerSecondsFromMidnight: null,
      scheduleSource: "connectivity",
      detail: "MT5 terminal process not running",
    };
  }

  if (input.feedAvailable === false) {
    return {
      state: "FEED_UNAVAILABLE",
      reason: "FEED_UNAVAILABLE",
      brokerClockFrozen: false,
      brokerDayOfWeek: null,
      brokerSecondsFromMidnight: null,
      scheduleSource: "connectivity",
      detail: "HFM quote feed unavailable while evaluating session",
    };
  }

  const brokerTime = asFinite(input.brokerTime);
  const gmtTime = asFinite(input.gmtTime);
  const frozen = inferMarketClosed(brokerTime, gmtTime, {
    terminalRunning: input.terminalRunning !== false,
    lagSec: lag,
  });

  const dow = brokerTime != null && brokerTime > 0 ? brokerDayOfWeekFromBrokerTime(brokerTime) : null;
  const sod = brokerTime != null && brokerTime > 0 ? brokerSecondsFromMidnight(brokerTime) : null;

  if (input.holidayHint === true) {
    return {
      state: "MARKET_HOLIDAY",
      reason: "HOLIDAY_CALENDAR_HINT",
      brokerClockFrozen: frozen,
      brokerDayOfWeek: dow,
      brokerSecondsFromMidnight: sod,
      scheduleSource: frozen ? "broker_clock_freeze" : "none",
      detail: "External holiday hint marked this symbol closed",
    };
  }

  // Broker clock freeze is authoritative for "session not trading now" even if
  // catalog still lists theoretical windows (weekends/holidays/maintenance).
  if (frozen) {
    return {
      state: "MARKET_CLOSED",
      reason: "BROKER_CLOCK_FROZEN",
      brokerClockFrozen: true,
      brokerDayOfWeek: dow,
      brokerSecondsFromMidnight: sod,
      scheduleSource: "broker_clock_freeze",
      detail: `TimeGMT ahead of TimeCurrent by >= ${lag}s`,
    };
  }

  const day = dow != null ? daySummaryFromSessions(input.sessions, dow) : null;
  const windows = tradeWindowsForDay(day);
  const hasSchedule = input.sessions != null && dow != null;

  if (hasSchedule && sod != null) {
    if (windows.length === 0) {
      return {
        state: "MARKET_CLOSED",
        reason: "NO_TRADE_WINDOWS_FOR_DAY",
        brokerClockFrozen: false,
        brokerDayOfWeek: dow,
        brokerSecondsFromMidnight: sod,
        scheduleSource: "catalog_sessions",
        detail: `Day ${dow} has no SymbolInfoSessionTrade windows`,
      };
    }
    if (isWithinTradeWindows(sod, windows)) {
      return {
        state: "MARKET_OPEN",
        reason: "WITHIN_TRADE_WINDOW",
        brokerClockFrozen: false,
        brokerDayOfWeek: dow,
        brokerSecondsFromMidnight: sod,
        scheduleSource: "catalog_sessions",
        detail: null,
      };
    }
    return {
      state: "TRADING_BREAK",
      reason: "OUTSIDE_TRADE_WINDOW",
      brokerClockFrozen: false,
      brokerDayOfWeek: dow,
      brokerSecondsFromMidnight: sod,
      scheduleSource: "catalog_sessions",
      detail: `Day ${dow} has trade windows but current broker TOD is outside them`,
    };
  }

  // No schedule + clocks advancing ⇒ treat as open (live HFM feed path).
  if (brokerTime != null && gmtTime != null && !frozen) {
    return {
      state: "MARKET_OPEN",
      reason: "BROKER_CLOCK_ADVANCING_NO_SCHEDULE",
      brokerClockFrozen: false,
      brokerDayOfWeek: dow,
      brokerSecondsFromMidnight: sod,
      scheduleSource: "none",
      detail: "Catalog sessions unavailable; broker clock not frozen",
    };
  }

  return {
    state: "SESSION_UNKNOWN",
    reason: "INSUFFICIENT_SESSION_EVIDENCE",
    brokerClockFrozen: false,
    brokerDayOfWeek: dow,
    brokerSecondsFromMidnight: sod,
    scheduleSource: "none",
    detail: "Missing broker/GMT clocks and/or catalog sessions",
  };
}

export function isMarketSessionClosedLike(state: HfmMarketSessionState): boolean {
  return (
    state === "MARKET_CLOSED" ||
    state === "TRADING_BREAK" ||
    state === "MARKET_HOLIDAY"
  );
}
