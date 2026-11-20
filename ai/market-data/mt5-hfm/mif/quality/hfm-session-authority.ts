/**
 * HFM_MT5 session-calendar authority from SymbolInfoSessionTrade/Quote catalog data.
 *
 * Source: MQL5 BuildSessionSummary → catalog current.json `sessions`.
 * Does not invent holidays, DST tables, or generic FX schedules.
 * Broker-server seconds-from-midnight + day-of-week match candle BROKER_SERVER opens.
 */
import type { HfmSessionDaySummary, HfmSessionSummary } from "../../catalog-types.js";
import type { MifExpectedIntervalAuthority } from "./types.js";

export const HFM_SESSION_AUTHORITY_ID = "hfm-mt5-symbol-sessions" as const;
export const HFM_SESSION_AUTHORITY_VERSION = "1.0.0" as const;

export type HfmNormalizedSessionDay = {
  day: number;
  tradeWindows: Array<{ fromSec: number; toSec: number }>;
  quoteWindows: Array<{ fromSec: number; toSec: number }>;
};

export type HfmNormalizedSessions = {
  symbol: string;
  days: HfmNormalizedSessionDay[];
  /** True when at least one day has a positive-length trade window. */
  hasTradeSchedule: boolean;
  /** Days explicitly closed (present with no positive trade window). */
  closedDays: number[];
  tradeSessionDays: number;
  quoteSessionDays: number;
  source: "catalog-sessions";
  limitations: readonly string[];
};

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function windowValid(from: number | null, to: number | null): from is number {
  return from != null && to != null && Number.isFinite(from) && Number.isFinite(to) && to > from;
}

/**
 * Catalog JSON stores day keys ("0".."6") alongside tradeSessionDays on the same object.
 * Also accepts `{ days: { "0": ... } }` if normalized upstream.
 */
export function normalizeHfmCatalogSessions(
  symbol: string,
  raw: HfmSessionSummary | Record<string, unknown> | null | undefined,
): HfmNormalizedSessions | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const daySource =
    root.days && typeof root.days === "object"
      ? (root.days as Record<string, unknown>)
      : root;

  const days: HfmNormalizedSessionDay[] = [];
  for (let day = 0; day <= 6; day++) {
    const entry = daySource[String(day)];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as HfmSessionDaySummary & {
      tradeWindows?: Array<{ fromSec?: number; toSec?: number; from?: number; to?: number }>;
      quoteWindows?: Array<{ fromSec?: number; toSec?: number; from?: number; to?: number }>;
    };

    const tradeWindows: Array<{ fromSec: number; toSec: number }> = [];
    const quoteWindows: Array<{ fromSec: number; toSec: number }> = [];

    if (Array.isArray(e.tradeWindows)) {
      for (const w of e.tradeWindows) {
        const from = asNum(w.fromSec ?? w.from);
        const to = asNum(w.toSec ?? w.to);
        if (windowValid(from, to)) tradeWindows.push({ fromSec: from, toSec: to });
      }
    } else {
      const from = asNum(e.tradeFrom);
      const to = asNum(e.tradeTo);
      if (windowValid(from, to)) tradeWindows.push({ fromSec: from, toSec: to });
    }

    if (Array.isArray(e.quoteWindows)) {
      for (const w of e.quoteWindows) {
        const from = asNum(w.fromSec ?? w.from);
        const to = asNum(w.toSec ?? w.to);
        if (windowValid(from, to)) quoteWindows.push({ fromSec: from, toSec: to });
      }
    } else {
      const from = asNum(e.quoteFrom);
      const to = asNum(e.quoteTo);
      if (windowValid(from, to)) quoteWindows.push({ fromSec: from, toSec: to });
    }

    days.push({ day, tradeWindows, quoteWindows });
  }

  if (days.length === 0) return null;

  const closedDays = days
    .filter((d) => d.tradeWindows.length === 0)
    .map((d) => d.day);
  const hasTradeSchedule = days.some((d) => d.tradeWindows.length > 0);
  if (!hasTradeSchedule) return null;

  const tradeSessionDays = days.filter((d) => d.tradeWindows.length > 0).length;
  const quoteSessionDays = days.filter((d) => d.quoteWindows.length > 0).length;

  return {
    symbol: String(symbol || "").trim().toUpperCase(),
    days,
    hasTradeSchedule,
    closedDays,
    tradeSessionDays,
    quoteSessionDays,
    source: "catalog-sessions",
    limitations: [
      "Holidays and early closures are not provided by SymbolInfoSession* and remain unknown",
      "Schedule reflects the catalog snapshot at discovery time (DST changes require catalog refresh)",
      "Only sessions present in the catalog row are used (multi-index when EA emits tradeWindows)",
    ],
  };
}

function dayOfWeekSun0(openTimeSec: number): number {
  // Broker-server unix-like open: day-of-week in the same epoch domain as session tables.
  return new Date(openTimeSec * 1000).getUTCDay();
}

function secondsFromMidnight(openTimeSec: number): number {
  return ((openTimeSec % 86_400) + 86_400) % 86_400;
}

function inWindows(sod: number, windows: Array<{ fromSec: number; toSec: number }>): boolean {
  for (const w of windows) {
    // MT5 sessions: [from, to). to=86400 means end-of-day.
    if (sod >= w.fromSec && sod < w.toSec) return true;
  }
  return false;
}

/**
 * Build MifExpectedIntervalAuthority from normalized HFM catalog sessions.
 * Returns null when schedule is unusable (caller keeps NO_AUTHORITATIVE_SESSION_CALENDAR).
 */
export function createHfmCatalogSessionAuthority(input: {
  providerSymbol: string;
  sessions: HfmSessionSummary | Record<string, unknown> | null | undefined;
  catalogVersion?: string | null;
}): MifExpectedIntervalAuthority | null {
  const normalized = normalizeHfmCatalogSessions(input.providerSymbol, input.sessions);
  if (!normalized) return null;

  const symbol = normalized.symbol;
  const byDay = new Map(normalized.days.map((d) => [d.day, d]));

  return {
    authorityId: HFM_SESSION_AUTHORITY_ID,
    authorityVersion:
      input.catalogVersion && String(input.catalogVersion).trim()
        ? `${HFM_SESSION_AUTHORITY_VERSION}+cat:${String(input.catalogVersion).trim()}`
        : HFM_SESSION_AUTHORITY_VERSION,
    isExpectedOpen(sym: string, _timeframe: string, openTimeSec: number): boolean | "unknown" {
      if (String(sym || "").trim().toUpperCase() !== symbol) return "unknown";
      if (!Number.isFinite(openTimeSec)) return "unknown";
      const dow = dayOfWeekSun0(openTimeSec);
      const day = byDay.get(dow);
      if (!day) return "unknown";
      if (day.tradeWindows.length === 0) {
        // Explicit empty trade session for this weekday in catalog → weekly closure.
        return false;
      }
      const sod = secondsFromMidnight(openTimeSec);
      return inWindows(sod, day.tradeWindows);
    },
    listExpectedOpensBetween(
      sym: string,
      timeframe: string,
      fromOpenExclusive: number,
      toOpenExclusive: number,
    ): number[] | "unsupported" {
      if (String(sym || "").trim().toUpperCase() !== symbol) return "unsupported";
      const step =
        timeframe.toUpperCase() === "H1"
          ? 3600
          : timeframe.toUpperCase() === "H4"
            ? 14_400
            : timeframe.toUpperCase() === "D1"
              ? 86_400
              : timeframe.toUpperCase() === "M15"
                ? 900
                : timeframe.toUpperCase() === "M5"
                  ? 300
                  : null;
      if (step == null) return "unsupported";
      if (!(toOpenExclusive > fromOpenExclusive)) return [];
      const out: number[] = [];
      for (let t = fromOpenExclusive + step; t < toOpenExclusive; t += step) {
        const open = Math.round(t);
        if (open <= fromOpenExclusive || open >= toOpenExclusive) continue;
        const d = this.isExpectedOpen(sym, timeframe, open);
        if (d === true) out.push(open);
        if (out.length > 10_000) break;
      }
      return out;
    },
  };
}
