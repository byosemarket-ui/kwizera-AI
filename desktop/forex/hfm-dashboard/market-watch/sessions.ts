/**
 * STEP 3A/3B — Trading session panel helpers.
 *
 * Catalog instruments expose MT5 per-day trade/quote windows (seconds from midnight),
 * not named Sydney/Tokyo/London/New York hubs. Do not invent hub names or open/closed
 * status from wall-clock guesses. Named hub overview remains unavailable unless backend
 * supplies named sessions.
 */

import type { HfmSessionSummary } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmMwSessionRow, HfmMwTradingSessionSummary } from "./types";

export type HfmMwNamedSessionPayload = {
  name: string;
  openTime?: string | null;
  closeTime?: string | null;
  status?: string | null;
  timeZone?: string | null;
  nextTransition?: string | null;
};

const MT5_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatSecondsOfDay(sec: number | null | undefined): string | null {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec < 0) return null;
  const s = Math.floor(sec) % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Overview "Trading Session" card — only when backend supplies a named current session.
 */
export function resolveTradingSessionOverview(
  named: HfmMwNamedSessionPayload | null | undefined,
): HfmMwTradingSessionSummary {
  if (!named || typeof named.name !== "string" || !named.name.trim()) {
    return {
      availability: "unavailable",
      name: null,
      status: null,
      openTime: null,
      closeTime: null,
      timeZone: null,
      reason:
        "Named trading-session status is not exposed by current HFM APIs; unavailable.",
    };
  }
  return {
    availability: "available",
    name: named.name.trim(),
    status: named.status ?? null,
    openTime: named.openTime ?? null,
    closeTime: named.closeTime ?? null,
    timeZone: named.timeZone ?? null,
    reason: null,
  };
}

/**
 * Panel rows from backend-named sessions only. Empty → unavailable UI.
 * Never injects fabricated FX-hub placeholders.
 */
export function resolveTradingSessionRows(
  namedSessions: HfmMwNamedSessionPayload[] | null | undefined,
): { availability: "available" | "unavailable"; rows: HfmMwSessionRow[]; reason: string | null } {
  if (!namedSessions || namedSessions.length === 0) {
    return {
      availability: "unavailable",
      rows: [],
      reason:
        "Broker named session schedule is unavailable. Select an instrument to view its MT5 day trade windows when present.",
    };
  }
  const rows: HfmMwSessionRow[] = namedSessions
    .filter((s) => typeof s.name === "string" && s.name.trim())
    .map((s) => ({
      name: s.name.trim(),
      openTime: s.openTime ?? null,
      closeTime: s.closeTime ?? null,
      status: s.status ?? null,
      timeZone: s.timeZone ?? null,
      nextTransition: s.nextTransition ?? null,
    }));
  if (rows.length === 0) {
    return {
      availability: "unavailable",
      rows: [],
      reason: "No valid named sessions returned by HFM backend.",
    };
  }
  return { availability: "available", rows, reason: null };
}

/**
 * Convert selected-instrument MT5 session day windows into panel rows.
 * Status is not inferred open/closed from local clock — windows are schedule metadata only.
 */
export function sessionsFromInstrumentMetadata(
  sessions: HfmSessionSummary | Record<string, unknown> | null | undefined,
  opts?: { symbol?: string | null },
): { availability: "available" | "unavailable"; rows: HfmMwSessionRow[]; reason: string | null } {
  if (!sessions || typeof sessions !== "object") {
    return {
      availability: "unavailable",
      rows: [],
      reason: opts?.symbol
        ? `No MT5 session windows on catalog instrument ${opts.symbol}.`
        : "No instrument selected for session windows.",
    };
  }

  const rows: HfmMwSessionRow[] = [];
  for (let day = 0; day <= 6; day += 1) {
    const raw = (sessions as Record<string, unknown>)[String(day)];
    if (!raw || typeof raw !== "object") continue;
    const dayRow = raw as {
      tradeFrom?: number | null;
      tradeTo?: number | null;
      quoteFrom?: number | null;
      quoteTo?: number | null;
    };
    const open = formatSecondsOfDay(dayRow.tradeFrom);
    const close = formatSecondsOfDay(dayRow.tradeTo);
    if (open == null && close == null) continue;
    rows.push({
      name: MT5_DAY_LABELS[day] ?? `Day ${day}`,
      openTime: open,
      closeTime: close,
      status: "Schedule",
      timeZone: "Broker server time (MT5 day window)",
      nextTransition: null,
    });
  }

  if (rows.length === 0) {
    const tradeDays =
      typeof (sessions as HfmSessionSummary).tradeSessionDays === "number"
        ? (sessions as HfmSessionSummary).tradeSessionDays
        : null;
    return {
      availability: "unavailable",
      rows: [],
      reason:
        tradeDays != null
          ? `Instrument reports ${tradeDays} trade session day(s) but no usable day windows.`
          : "Instrument session metadata has no usable day windows.",
    };
  }

  return { availability: "available", rows, reason: null };
}
