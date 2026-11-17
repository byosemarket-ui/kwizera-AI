/**
 * STEP 3A — Trading session panel foundation.
 *
 * Catalog instruments may expose per-symbol session day summaries (trade/quote windows),
 * but there is no confirmed HFM API that returns named global FX-hub open/closed status.
 * Do not invent those rows from screenshots or wall-clock guesses.
 */

import type { HfmMwSessionRow, HfmMwTradingSessionSummary } from "./types";

export type HfmMwNamedSessionPayload = {
  name: string;
  openTime?: string | null;
  closeTime?: string | null;
  status?: string | null;
  timeZone?: string | null;
  nextTransition?: string | null;
};

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
 * Panel rows — only from backend-named sessions. Empty → unavailable UI.
 * Never injects fabricated named FX-hub placeholders.
 */
export function resolveTradingSessionRows(
  namedSessions: HfmMwNamedSessionPayload[] | null | undefined,
): { availability: "available" | "unavailable"; rows: HfmMwSessionRow[]; reason: string | null } {
  if (!namedSessions || namedSessions.length === 0) {
    return {
      availability: "unavailable",
      rows: [],
      reason:
        "Broker named session schedule is unavailable. Per-symbol session windows exist on catalog instruments but are not shown as global FX hubs.",
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
