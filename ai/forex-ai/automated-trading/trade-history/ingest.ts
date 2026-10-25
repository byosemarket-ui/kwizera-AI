/**
 * Phase 60.0.3 — Ingest broker-confirmed open/closed trade snapshots into durable history.
 * Never marks CLOSED merely because a trade is absent from an open snapshot.
 */
import {
  TRADE_HISTORY_SCHEMA_VERSION,
  type TradeHistoryRecord,
} from "./types.js";
import {
  buildTradeHistoryRecordKey,
  getAtTradeHistoryStore,
  type AtTradeHistoryStore,
} from "./store.js";
import { safeFiniteNumber as asFinite } from "./safe-number.js";

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export interface IngestTradeSnapshotInput {
  environment: string;
  openTrades?: unknown;
  closedTrades?: unknown;
  observedAtUtc?: string;
  storageRoot?: string;
  store?: AtTradeHistoryStore;
}

export interface IngestTradeSnapshotResult {
  ok: true;
  placesOrders: false;
  mutatesBroker: false;
  openUpserted: number;
  closedUpserted: number;
  skipped: number;
  skippedMissingId: number;
  historyAvailableFromUtc: string | null;
}

function rowsFromBlock(block: unknown, keys: string[]): Record<string, unknown>[] {
  if (!block || typeof block !== "object") return [];
  const o = block as Record<string, unknown>;
  for (const k of keys) {
    if (Array.isArray(o[k])) {
      return (o[k] as unknown[]).filter((r) => r && typeof r === "object") as Record<string, unknown>[];
    }
  }
  return [];
}

function mapOpenRow(
  row: Record<string, unknown>,
  environment: string,
  observedAtUtc: string,
): TradeHistoryRecord | null {
  const tradeId = asString(row.tradeId);
  const accountIdMasked = asString(row.accountIdMasked);
  const key = buildTradeHistoryRecordKey({ environment, accountIdMasked, tradeId: tradeId ?? "" });
  if (!key || !tradeId) return null;
  const grossPl = asFinite(row.floatingPl ?? row.grossPl ?? row.grossPL);
  return {
    recordKey: key,
    schemaVersion: TRADE_HISTORY_SCHEMA_VERSION,
    environment: String(environment).trim().toUpperCase(),
    accountIdMasked,
    tradeId,
    orderId: asString(row.orderId ?? row.openOrderId),
    instrument: asString(row.instrument),
    offerId: asString(row.offerId),
    side: asString(row.side),
    amount: asFinite(row.amount),
    openRate: asFinite(row.openRate),
    closeRate: null,
    openTime: asString(row.openTime),
    closeTime: null,
    grossPl,
    commission: asFinite(row.commission),
    rolloverInterest: asFinite(row.rolloverInterest),
    netPl: null,
    plBasis: grossPl != null ? "gross" : null,
    lifecycleStatus: "OPEN",
    source: "forexconnect-trades",
    sourceTimestamp: asString(row.openTime) ?? observedAtUtc,
    observedAtUtc,
    updatedAtUtc: observedAtUtc,
    historyScopeNote: "Open trade observed from ForexConnect Trades table.",
  };
}

function mapClosedRow(
  row: Record<string, unknown>,
  environment: string,
  observedAtUtc: string,
): TradeHistoryRecord | null {
  const tradeId = asString(row.tradeId);
  const accountIdMasked = asString(row.accountIdMasked);
  const key = buildTradeHistoryRecordKey({ environment, accountIdMasked, tradeId: tradeId ?? "" });
  if (!key || !tradeId) return null;
  const grossPl = asFinite(row.grossPl ?? row.grossPL);
  const commission = asFinite(row.commission);
  const rolloverInterest = asFinite(row.rolloverInterest);
  let netPl = asFinite(row.netPl);
  if (netPl == null && grossPl != null && commission != null && rolloverInterest != null) {
    netPl = grossPl + commission + rolloverInterest;
  }
  return {
    recordKey: key,
    schemaVersion: TRADE_HISTORY_SCHEMA_VERSION,
    environment: String(environment).trim().toUpperCase(),
    accountIdMasked,
    tradeId,
    orderId: asString(row.orderId ?? row.openOrderId),
    instrument: asString(row.instrument),
    offerId: asString(row.offerId),
    side: asString(row.side),
    amount: asFinite(row.amount),
    openRate: asFinite(row.openRate),
    closeRate: asFinite(row.closeRate),
    openTime: asString(row.openTime),
    closeTime: asString(row.closeTime),
    grossPl,
    commission,
    rolloverInterest,
    netPl,
    plBasis: grossPl != null ? "gross" : null,
    lifecycleStatus: "CLOSED",
    source: "forexconnect-closed-trades",
    sourceTimestamp: asString(row.closeTime) ?? asString(row.openTime) ?? observedAtUtc,
    observedAtUtc,
    updatedAtUtc: observedAtUtc,
    historyScopeNote:
      "Closed trade observed from ForexConnect ClosedTrades (current trading day scope at source).",
  };
}

/**
 * Persist open + closed broker snapshots. Absence from open trades does NOT imply close.
 */
export async function ingestBrokerTradeSnapshots(
  input: IngestTradeSnapshotInput,
): Promise<IngestTradeSnapshotResult> {
  const observedAtUtc = input.observedAtUtc ?? new Date().toISOString();
  const environment = String(input.environment ?? "").trim() || "UNKNOWN";
  const store = input.store ?? getAtTradeHistoryStore(input.storageRoot);

  const openRows = rowsFromBlock(input.openTrades, ["trades", "items"]);
  const closedRows = rowsFromBlock(input.closedTrades, ["closedTrades", "trades", "items"]);

  let openUpserted = 0;
  let closedUpserted = 0;
  let skipped = 0;
  let skippedMissingId = 0;

  for (const row of openRows) {
    const mapped = mapOpenRow(row, environment, observedAtUtc);
    if (!mapped) {
      skippedMissingId += 1;
      skipped += 1;
      continue;
    }
    // Do not overwrite an already-CLOSED record with an OPEN snapshot missing close evidence.
    const existing = store.getByKey(mapped.recordKey);
    if (existing?.lifecycleStatus === "CLOSED") {
      skipped += 1;
      continue;
    }
    await store.upsert(mapped);
    openUpserted += 1;
  }

  for (const row of closedRows) {
    const mapped = mapClosedRow(row, environment, observedAtUtc);
    if (!mapped) {
      skippedMissingId += 1;
      skipped += 1;
      continue;
    }
    await store.upsert(mapped);
    closedUpserted += 1;
  }

  const snap = store.snapshot();
  return {
    ok: true,
    placesOrders: false,
    mutatesBroker: false,
    openUpserted,
    closedUpserted,
    skipped,
    skippedMissingId,
    historyAvailableFromUtc: snap.historyAvailableFromUtc,
  };
}
