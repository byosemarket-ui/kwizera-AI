/**
 * Phase 60.0.3 — Durable trade-history persistence (safe-json + storage root).
 * Idempotent upserts by environment|accountMasked|tradeId. Never invents closes.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import {
  TRADE_HISTORY_SCHEMA_VERSION,
  type TradeHistoryFile,
  type TradeHistoryQuery,
  type TradeHistoryQueryResult,
  type TradeHistoryRecord,
} from "./types.js";

const MAX_RECORDS = 5_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const COVERAGE_NOTE =
  "Persisted history starts at first local observation. ForexConnect ClosedTrades is current-trading-day only — earlier broker closes are not recoverable from that table alone.";

function filePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "trade-history.json",
  );
}

export function buildTradeHistoryRecordKey(input: {
  environment: string;
  accountIdMasked: string | null;
  tradeId: string;
}): string | null {
  const env = String(input.environment ?? "").trim().toUpperCase();
  const tradeId = String(input.tradeId ?? "").trim();
  if (!env || !tradeId) return null;
  const acct = input.accountIdMasked != null && String(input.accountIdMasked).trim()
    ? String(input.accountIdMasked).trim()
    : "unknown";
  return `${env}|${acct}|${tradeId}`;
}

function emptyFile(): TradeHistoryFile {
  return {
    schemaVersion: TRADE_HISTORY_SCHEMA_VERSION,
    provider: "FOREXCONNECT",
    historyAvailableFromUtc: null,
    updatedAtUtc: new Date().toISOString(),
    records: [],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

function normalize(raw: unknown): TradeHistoryFile {
  const empty = emptyFile();
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const records = Array.isArray(o.records)
    ? (o.records as TradeHistoryRecord[])
      .filter((r) => r && typeof r === "object" && typeof r.recordKey === "string" && typeof r.tradeId === "string")
      .slice(0, MAX_RECORDS)
    : [];
  let historyAvailableFromUtc =
    typeof o.historyAvailableFromUtc === "string" ? o.historyAvailableFromUtc : null;
  if (!historyAvailableFromUtc && records.length) {
    const times = records
      .map((r) => r.observedAtUtc)
      .filter((t): t is string => typeof t === "string" && Number.isFinite(Date.parse(t)))
      .sort();
    historyAvailableFromUtc = times[0] ?? null;
  }
  return {
    schemaVersion: TRADE_HISTORY_SCHEMA_VERSION,
    provider: "FOREXCONNECT",
    historyAvailableFromUtc,
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : empty.updatedAtUtc,
    records,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

function parseIsoMs(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

function recordSortKey(r: TradeHistoryRecord): number {
  return (
    parseIsoMs(r.closeTime)
    ?? parseIsoMs(r.openTime)
    ?? parseIsoMs(r.updatedAtUtc)
    ?? parseIsoMs(r.observedAtUtc)
    ?? 0
  );
}

function mergeRecord(
  existing: TradeHistoryRecord | undefined,
  incoming: TradeHistoryRecord,
): TradeHistoryRecord {
  if (!existing) return incoming;
  // Once CLOSED with broker evidence, never regress to OPEN from a missing open snapshot alone.
  const lifecycleStatus =
    existing.lifecycleStatus === "CLOSED" || incoming.lifecycleStatus === "CLOSED"
      ? "CLOSED"
      : "OPEN";
  const preferClosedSource =
    lifecycleStatus === "CLOSED"
    && (incoming.source === "forexconnect-closed-trades"
      || existing.source === "forexconnect-closed-trades");

  return {
    ...existing,
    ...incoming,
    recordKey: existing.recordKey,
    schemaVersion: TRADE_HISTORY_SCHEMA_VERSION,
    observedAtUtc: existing.observedAtUtc || incoming.observedAtUtc,
    updatedAtUtc: incoming.updatedAtUtc,
    lifecycleStatus,
    source: preferClosedSource
      ? "forexconnect-closed-trades"
      : incoming.source,
    // Preserve closed evidence fields when a later open snapshot omits them.
    closeRate: incoming.closeRate ?? existing.closeRate,
    closeTime: incoming.closeTime ?? existing.closeTime,
    grossPl:
      lifecycleStatus === "CLOSED"
        ? (incoming.grossPl ?? existing.grossPl)
        : (incoming.grossPl ?? existing.grossPl),
    commission: incoming.commission ?? existing.commission,
    rolloverInterest: incoming.rolloverInterest ?? existing.rolloverInterest,
    netPl: incoming.netPl ?? existing.netPl,
    orderId: incoming.orderId ?? existing.orderId,
    openRate: incoming.openRate ?? existing.openRate,
    openTime: incoming.openTime ?? existing.openTime,
    instrument: incoming.instrument ?? existing.instrument,
    offerId: incoming.offerId ?? existing.offerId,
    side: incoming.side ?? existing.side,
    amount: incoming.amount ?? existing.amount,
    historyScopeNote: incoming.historyScopeNote || existing.historyScopeNote,
  };
}

export class AtTradeHistoryStore {
  private data: TradeHistoryFile;
  private readonly file: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot?: string) {
    this.file = filePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  snapshot(): TradeHistoryFile {
    return {
      ...this.data,
      records: this.data.records.map((r) => ({ ...r })),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  }

  getByKey(recordKey: string): TradeHistoryRecord | null {
    return this.data.records.find((r) => r.recordKey === recordKey) ?? null;
  }

  /**
   * Idempotent upsert. Returns null when key cannot be formed (missing tradeId/environment).
   */
  async upsert(record: TradeHistoryRecord): Promise<TradeHistoryRecord | null> {
    if (!record.recordKey || !record.tradeId) return null;
    const run = this.writeChain.then(async () => {
      const idx = this.data.records.findIndex((r) => r.recordKey === record.recordKey);
      const existing = idx >= 0 ? this.data.records[idx] : undefined;
      const merged = mergeRecord(existing, record);
      if (idx >= 0) this.data.records[idx] = merged;
      else this.data.records.unshift(merged);

      if (!this.data.historyAvailableFromUtc) {
        this.data.historyAvailableFromUtc = merged.observedAtUtc;
      } else {
        const prev = parseIsoMs(this.data.historyAvailableFromUtc);
        const next = parseIsoMs(merged.observedAtUtc);
        if (prev != null && next != null && next < prev) {
          this.data.historyAvailableFromUtc = merged.observedAtUtc;
        }
      }

      this.data.records.sort((a, b) => recordSortKey(b) - recordSortKey(a));
      this.data.records = this.data.records.slice(0, MAX_RECORDS);
      this.data.updatedAtUtc = new Date().toISOString();
      this.data.schemaVersion = TRADE_HISTORY_SCHEMA_VERSION;
      this.data.placesOrders = false;
      this.data.acceptsForExecution = false;
      this.data.mutatesBroker = false;
      await writeJsonAtomic(this.file, this.data);
      return merged;
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  async upsertMany(records: TradeHistoryRecord[]): Promise<{ upserted: number; skipped: number }> {
    let upserted = 0;
    let skipped = 0;
    for (const r of records) {
      const out = await this.upsert(r);
      if (out) upserted += 1;
      else skipped += 1;
    }
    return { upserted, skipped };
  }

  private filterRecords(input: TradeHistoryQuery = {}): TradeHistoryRecord[] {
    const fromMs = parseIsoMs(input.fromUtc ?? null);
    const toMs = parseIsoMs(input.toUtc ?? null);
    const instrumentFilter = input.instrument
      ? String(input.instrument).trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
      : "";
    const directionFilter = input.direction
      ? String(input.direction).trim().toUpperCase()
      : "";
    const statusFilter = input.status && input.status !== "ALL" ? input.status : null;
    const envFilter = input.environment
      ? String(input.environment).trim().toUpperCase()
      : "";
    const accountFilter = input.accountIdMasked
      ? String(input.accountIdMasked).trim()
      : "";

    const filtered = this.data.records.filter((r) => {
      if (statusFilter && r.lifecycleStatus !== statusFilter) return false;
      if (envFilter && String(r.environment ?? "").toUpperCase() !== envFilter) return false;
      if (accountFilter && String(r.accountIdMasked ?? "") !== accountFilter) return false;
      if (instrumentFilter) {
        const inst = String(r.instrument ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (inst !== instrumentFilter) return false;
      }
      if (directionFilter) {
        const side = String(r.side ?? "").toUpperCase();
        const isBuy = side === "B" || side === "BUY" || side.includes("BUY");
        const isSell = side === "S" || side === "SELL" || side.includes("SELL");
        if (directionFilter === "BUY" && !isBuy) return false;
        if (directionFilter === "SELL" && !isSell) return false;
      }
      const t = recordSortKey(r);
      if (fromMs != null && t < fromMs) return false;
      if (toMs != null && t > toMs) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const d = recordSortKey(b) - recordSortKey(a);
      if (d !== 0) return d;
      return a.recordKey.localeCompare(b.recordKey);
    });
    return filtered;
  }

  query(input: TradeHistoryQuery = {}): TradeHistoryQueryResult {
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(input.limit ?? DEFAULT_LIMIT)));
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const filtered = this.filterRecords(input);

    return {
      ok: true,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      historyAvailableFromUtc: this.data.historyAvailableFromUtc,
      coverageNote: COVERAGE_NOTE,
      total: filtered.length,
      limit,
      offset,
      records: filtered.slice(offset, offset + limit).map((r) => ({ ...r })),
    };
  }

  /**
   * Phase 60.0.4 — matching rows for analytics (capped), bypassing UI page-size max.
   * Callers must not treat the cap as proof of all-time completeness.
   */
  queryMatchingAll(input: TradeHistoryQuery = {}, max = 5_000): TradeHistoryRecord[] {
    const cap = Math.max(1, Math.min(MAX_RECORDS, Math.floor(max)));
    return this.filterRecords(input).slice(0, cap).map((r) => ({ ...r }));
  }
}

let singleton: AtTradeHistoryStore | null = null;

export function getAtTradeHistoryStore(storageRoot?: string): AtTradeHistoryStore {
  if (storageRoot) return new AtTradeHistoryStore(storageRoot);
  if (!singleton) singleton = new AtTradeHistoryStore();
  return singleton;
}

export function resetAtTradeHistoryStoreForTests(): void {
  singleton = null;
}

export { COVERAGE_NOTE as TRADE_HISTORY_COVERAGE_NOTE };
