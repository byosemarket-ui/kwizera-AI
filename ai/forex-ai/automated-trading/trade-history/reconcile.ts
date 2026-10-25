/**
 * Phase 60.0.4 — Safe reconciliation across open/closed/history/summary/orders.
 * Never infers closure from absence. Never double-counts overlapping sources.
 */

export type ReconciliationSeverity = "info" | "warn";

export interface ReconciliationFinding {
  code: string;
  severity: ReconciliationSeverity;
  message: string;
  tradeId?: string | null;
  recordKey?: string | null;
  instrument?: string | null;
}

export interface ReconciliationSnapshot {
  schemaVersion: "60.0.4";
  placesOrders: false;
  mutatesBroker: false;
  openTradeCount: number;
  historyOpenCount: number;
  historyClosedCount: number;
  closedDayCount: number;
  activeOrderCount: number;
  /** Open tradeIds also present as CLOSED in persisted history (overlap — count once per scope). */
  openOverlappingClosedKeys: string[];
  /** Persisted OPEN rows whose tradeId is absent from current broker open snapshot (not inferred closed). */
  historyOpenMissingFromBroker: string[];
  /** Broker open tradeIds not yet in persisted history. */
  brokerOpenMissingFromHistory: string[];
  summaryInstrumentCount: number;
  findings: ReconciliationFinding[];
  notes: string[];
}

function idOf(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function reconcileTradeMonitorSources(input: {
  environment?: string | null;
  openTrades: ReadonlyArray<{ tradeId?: string | null; accountIdMasked?: string | null }>;
  closedDayTrades: ReadonlyArray<{ tradeId?: string | null }>;
  historyRecords: ReadonlyArray<{
    recordKey?: string | null;
    tradeId?: string | null;
    accountIdMasked?: string | null;
    lifecycleStatus?: string | null;
  }>;
  activeOrders: ReadonlyArray<{ orderId?: string | null }>;
  instrumentSummaries: ReadonlyArray<{ instrument?: string | null; netPl?: number | null }>;
}): ReconciliationSnapshot {
  const findings: ReconciliationFinding[] = [];
  const notes: string[] = [
    "Absence from the open Trades table does not imply a trade closed.",
    "Summary NetPL is instrument-scoped — do not sum with trade floating P/L.",
    "Working orders are never counted as executed trades.",
  ];

  const openIds = new Set<string>();
  for (const t of input.openTrades) {
    const id = idOf(t.tradeId);
    if (!id) {
      findings.push({
        code: "OPEN_TRADE_MISSING_ID",
        severity: "warn",
        message: "Open trade row missing tradeId — excluded from reconciliation keys.",
      });
      continue;
    }
    openIds.add(id);
  }

  const historyOpenIds = new Set<string>();
  const historyClosedIds = new Set<string>();
  for (const r of input.historyRecords) {
    const id = idOf(r.tradeId);
    if (!id) continue;
    if (String(r.lifecycleStatus ?? "").toUpperCase() === "CLOSED") historyClosedIds.add(id);
    else historyOpenIds.add(id);
  }

  const openOverlappingClosedKeys: string[] = [];
  for (const id of openIds) {
    if (historyClosedIds.has(id)) {
      openOverlappingClosedKeys.push(id);
      findings.push({
        code: "OPEN_OVERLAPS_HISTORY_CLOSED",
        severity: "warn",
        tradeId: id,
        message:
          "Trade ID appears in current open Trades and as CLOSED in persisted history — keep scopes separate; do not double-count P/L.",
      });
    }
  }

  const historyOpenMissingFromBroker: string[] = [];
  for (const id of historyOpenIds) {
    if (!openIds.has(id) && !historyClosedIds.has(id)) {
      historyOpenMissingFromBroker.push(id);
      findings.push({
        code: "HISTORY_OPEN_ABSENT_FROM_BROKER",
        severity: "info",
        tradeId: id,
        message:
          "Persisted OPEN record not in current broker open snapshot — not inferred as closed without ClosedTrades evidence.",
      });
    }
  }

  const brokerOpenMissingFromHistory: string[] = [];
  for (const id of openIds) {
    if (!historyOpenIds.has(id) && !historyClosedIds.has(id)) {
      brokerOpenMissingFromHistory.push(id);
      findings.push({
        code: "BROKER_OPEN_NOT_YET_PERSISTED",
        severity: "info",
        tradeId: id,
        message: "Broker open trade not yet observed in persisted history (will upsert on next RO ingest).",
      });
    }
  }

  // Orders vs trades: ensure no orderId is treated as tradeId in open set by coincidence only — informational.
  for (const o of input.activeOrders) {
    const oid = idOf(o.orderId);
    if (oid && openIds.has(oid)) {
      findings.push({
        code: "ORDER_ID_EQUALS_TRADE_ID",
        severity: "warn",
        tradeId: oid,
        message:
          "An Order ID matches an open Trade ID string — UI must keep Orders and Trades tables distinct.",
      });
    }
  }

  if (input.instrumentSummaries.length > 0) {
    notes.push(
      `Instrument Summary rows: ${input.instrumentSummaries.length}. NetPL remains INSTRUMENT_SUMMARY scope.`,
    );
  }

  return {
    schemaVersion: "60.0.4",
    placesOrders: false,
    mutatesBroker: false,
    openTradeCount: openIds.size,
    historyOpenCount: historyOpenIds.size,
    historyClosedCount: historyClosedIds.size,
    closedDayCount: input.closedDayTrades.filter((t) => idOf(t.tradeId)).length,
    activeOrderCount: input.activeOrders.filter((o) => idOf(o.orderId)).length,
    openOverlappingClosedKeys,
    historyOpenMissingFromBroker,
    brokerOpenMissingFromHistory,
    summaryInstrumentCount: input.instrumentSummaries.length,
    findings,
    notes,
  };
}

/**
 * Select realized source for a period without double-counting day ClosedTrades and persisted CLOSED.
 * Prefer persisted history when the tradeId exists there; otherwise include day closed rows.
 */
export function mergeClosedSourcesWithoutDoubleCount(input: {
  persistedClosed: ReadonlyArray<{ tradeId?: string | null; recordKey?: string | null; grossPl?: number | null }>;
  dayClosed: ReadonlyArray<{ tradeId?: string | null; grossPl?: number | null }>;
}): Array<{ tradeId: string | null; grossPl: number | null; source: "persisted" | "day_closed" }> {
  const out: Array<{ tradeId: string | null; grossPl: number | null; source: "persisted" | "day_closed" }> = [];
  const seen = new Set<string>();
  for (const r of input.persistedClosed) {
    const id = idOf(r.tradeId);
    const key = idOf(r.recordKey) ?? id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (id) seen.add(id);
    out.push({ tradeId: id, grossPl: r.grossPl ?? null, source: "persisted" });
  }
  for (const r of input.dayClosed) {
    const id = idOf(r.tradeId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ tradeId: id, grossPl: r.grossPl ?? null, source: "day_closed" });
  }
  return out;
}
