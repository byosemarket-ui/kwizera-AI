/**
 * Phase 60.0.10 — Trade Monitor view selection and record filtering.
 * Read-only. Never infers closure from absence of an OPEN snapshot.
 */
import type {
  TradeMonitorClosedTradeRow,
  TradeMonitorHistoryRecord,
  TradeMonitorOrderRow,
  TradeMonitorPositionRow,
} from "./types";

export type TradeMonitorViewId = "live" | "closed_24h" | "history" | "all";

export const TRADE_MONITOR_VIEWS: ReadonlyArray<{
  id: TradeMonitorViewId;
  label: string;
  shortLabel: string;
}> = [
  { id: "live", label: "LIVE", shortLabel: "LIVE" },
  { id: "closed_24h", label: "CLOSED <24H", shortLabel: "CLOSED" },
  { id: "history", label: "HISTORY", shortLabel: "HISTORY" },
  { id: "all", label: "ALL", shortLabel: "ALL" },
];

const MS_24H = 24 * 60 * 60 * 1000;

export function parseTradeTimeMs(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** CLOSED <24H uses actual close timestamps in a rolling window — not trading-day alone. */
export function isClosedWithinRolling24h(
  closeTime: string | null | undefined,
  nowMs: number,
): boolean {
  const closeMs = parseTradeTimeMs(closeTime);
  if (closeMs == null) return false;
  const age = nowMs - closeMs;
  return age >= 0 && age <= MS_24H;
}

export function filterClosedDayWithin24h(
  rows: TradeMonitorClosedTradeRow[],
  nowMs: number,
): TradeMonitorClosedTradeRow[] {
  return rows.filter((row) => isClosedWithinRolling24h(row.closeTime, nowMs));
}

export function filterHistoryClosedWithin24h(
  rows: TradeMonitorHistoryRecord[],
  nowMs: number,
): TradeMonitorHistoryRecord[] {
  return rows.filter(
    (row) =>
      row.lifecycleStatus === "CLOSED"
      && isClosedWithinRolling24h(row.closeTime, nowMs),
  );
}

/** Stable identity: tradeId alone is not enough across accounts/environments. */
export function tradeScopeKey(
  tradeId: string | null | undefined,
  accountIdMasked: string | null | undefined,
): string | null {
  const id = tradeId?.trim() || "";
  if (!id) return null;
  const acct = (accountIdMasked ?? "").trim() || "_";
  return `${acct}|${id}`;
}

export interface Closed24hBundle {
  fromDayTable: TradeMonitorClosedTradeRow[];
  fromHistory: TradeMonitorHistoryRecord[];
  /** Deduped by account-scoped trade identity. */
  tradeIds: string[];
  coverageNote: string;
}

/**
 * Build CLOSED <24H from broker day table + persisted CLOSED history.
 * Does not claim completeness when closeTime is missing or sources are partial.
 */
export function buildClosed24hBundle(input: {
  dayClosed: TradeMonitorClosedTradeRow[];
  historyRecords: TradeMonitorHistoryRecord[];
  nowMs: number;
  historyAvailableFromUtc: string | null;
}): Closed24hBundle {
  const fromDayTable = filterClosedDayWithin24h(input.dayClosed, input.nowMs);
  const fromHistory = filterHistoryClosedWithin24h(input.historyRecords, input.nowMs);
  const ids = new Set<string>();
  for (const row of fromDayTable) {
    const key = tradeScopeKey(row.tradeId, row.accountIdMasked);
    if (key) ids.add(key);
  }
  for (const row of fromHistory) {
    const key = tradeScopeKey(row.tradeId, row.accountIdMasked);
    if (key) ids.add(key);
  }
  const dayOnlyMissingTime = input.dayClosed.filter(
    (r) => r.closeTime == null || parseTradeTimeMs(r.closeTime) == null,
  ).length;
  const parts = [
    "Rolling 24h by close timestamp (not broker trading-day alone).",
    input.historyAvailableFromUtc
      ? `Persisted history available from ${input.historyAvailableFromUtc}.`
      : "Persisted history start unknown — window may be incomplete.",
  ];
  if (dayOnlyMissingTime > 0) {
    parts.push(
      `${dayOnlyMissingTime} broker ClosedTrades row(s) lacked a parseable closeTime and were excluded.`,
    );
  }
  return {
    fromDayTable,
    fromHistory,
    tradeIds: [...ids],
    coverageNote: parts.join(" "),
  };
}

export interface AllViewRow {
  key: string;
  tradeId: string | null;
  instrument: string | null;
  side: string | null;
  amount: number | null;
  openRate: number | null;
  closeRate: number | null;
  currentPrice: number | null;
  markFreshness: string | null;
  pl: number | null;
  plKind: "floating" | "realized" | "none";
  status: string;
  timeIso: string | null;
  source: string;
  lifecycle: "OPEN" | "CLOSED";
}

/**
 * ALL view: open trades + closed history + day closed.
 * Deduped by account-scoped trade identity (masked account + tradeId).
 * Open snapshot wins over CLOSED for the same scoped id (never infer close from absence).
 */
export function buildAllViewRows(input: {
  openTrades: TradeMonitorPositionRow[];
  dayClosed: TradeMonitorClosedTradeRow[];
  historyRecords: TradeMonitorHistoryRecord[];
}): AllViewRow[] {
  const byScope = new Map<string, AllViewRow>();
  const extras: AllViewRow[] = [];

  for (const row of input.openTrades) {
    const scope = tradeScopeKey(row.tradeId, row.accountIdMasked);
    const mapped: AllViewRow = {
      key: scope
        ? `open:${scope}`
        : `open:${row.accountIdMasked ?? "_"}:${row.instrument ?? "x"}:${row.openTime ?? row.updatedAt ?? "na"}:${row.amount ?? "a"}`,
      tradeId: row.tradeId,
      instrument: row.instrument,
      side: row.side,
      amount: row.amount,
      openRate: row.openRate,
      closeRate: null,
      currentPrice: row.currentPrice,
      markFreshness: row.markQuoteFreshness,
      pl: row.floatingPl,
      plKind: row.floatingPl != null ? "floating" : "none",
      status: row.status || "OPEN",
      timeIso: row.openTime ?? row.updatedAt,
      source: row.source,
      lifecycle: "OPEN",
    };
    if (scope) byScope.set(scope, mapped);
    else extras.push(mapped);
  }

  const addClosed = (
    tradeId: string | null,
    accountIdMasked: string | null | undefined,
    mapped: AllViewRow,
  ) => {
    const scope = tradeScopeKey(tradeId, accountIdMasked);
    if (scope && byScope.has(scope) && byScope.get(scope)!.lifecycle === "OPEN") {
      // Keep OPEN — do not replace with CLOSED merely because history also has the id.
      return;
    }
    if (scope) {
      if (!byScope.has(scope)) byScope.set(scope, mapped);
      return;
    }
    extras.push(mapped);
  };

  for (const row of input.historyRecords) {
    if (row.lifecycleStatus !== "CLOSED") continue;
    addClosed(row.tradeId, row.accountIdMasked, {
      key: `hist:${row.recordKey}`,
      tradeId: row.tradeId,
      instrument: row.instrument,
      side: row.side,
      amount: row.amount,
      openRate: row.openRate,
      closeRate: row.closeRate,
      currentPrice: null,
      markFreshness: null,
      pl: row.grossPl,
      plKind: row.grossPl != null ? "realized" : "none",
      status: "CLOSED",
      timeIso: row.closeTime ?? row.openTime,
      source: row.source,
      lifecycle: "CLOSED",
    });
  }

  for (const row of input.dayClosed) {
    const scope = tradeScopeKey(row.tradeId, row.accountIdMasked);
    addClosed(row.tradeId, row.accountIdMasked, {
      key: scope
        ? `day:${scope}`
        : `day:${row.tradeId ?? row.closeTime ?? row.instrument ?? "c"}`,
      tradeId: row.tradeId,
      instrument: row.instrument,
      side: row.side,
      amount: row.amount,
      openRate: row.openRate,
      closeRate: row.closeRate,
      currentPrice: null,
      markFreshness: null,
      pl: row.grossPl ?? row.netPl,
      plKind: row.grossPl != null || row.netPl != null ? "realized" : "none",
      status: "CLOSED",
      timeIso: row.closeTime,
      source: row.source,
      lifecycle: "CLOSED",
    });
  }

  return [...byScope.values(), ...extras];
}

export function countLiveTrades(open: TradeMonitorPositionRow[]): number {
  return open.length;
}

export function countActiveOrders(orders: TradeMonitorOrderRow[]): number {
  return orders.length;
}
