/**
 * Phase 4.18F.2.2 — Bounded durable genuine-tick capture store.
 *
 * Atomic writes via writeJsonAtomicSync (temp + rename).
 * Corrupt/partial JSON is quarantined by readJsonSafeSync and recovered as empty.
 * Retention: per-instrument max records + max age. No credentials stored.
 */

import path from "node:path";
import { readJsonSafeSync, writeJsonAtomicSync } from "../../../storage/safe-json.js";
import { GENUINE_TICK_SCHEMA, type GenuineTickRecord, type TickCaptureCounters } from "./genuine-tick-types.js";

export const GENUINE_TICK_STORE_FILE_VERSION = 1 as const;
export const GENUINE_TICK_STORE_SCHEMA = "kwizera.fc-genuine-tick-store.v1" as const;

/** Enough for dense 60m windows without unbounded growth. */
export const GENUINE_TICK_MAX_PER_INSTRUMENT = 4_000;
/** Keep slightly beyond 60m for recovery/gaps. */
export const GENUINE_TICK_MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const GENUINE_TICK_DEDUPE_SET_MAX = 8_000;

export interface GenuineTickStoreFile {
  version: typeof GENUINE_TICK_STORE_FILE_VERSION;
  schemaVersion: typeof GENUINE_TICK_STORE_SCHEMA;
  provider: "FOREXCONNECT";
  updatedAtMs: number;
  nextSequence: number;
  counters: TickCaptureCounters;
  /** instrument → ticks (receipt-ordered, newest last). */
  byInstrument: Record<string, GenuineTickRecord[]>;
  /** Recent dedupe ids (ring). */
  recentDedupeIds: string[];
}

export interface GenuineTickAppendResult {
  accepted: boolean;
  duplicate: boolean;
  persisted: boolean;
  filtered: boolean;
  record: GenuineTickRecord | null;
  reason: string;
  recoveredCorrupt: boolean;
}

function emptyCounters(): TickCaptureCounters {
  return {
    received: 0,
    accepted: 0,
    filtered: 0,
    persisted: 0,
    duplicates: 0,
    persistenceFailures: 0,
    processingFailures: 0,
    lastAcceptedAtMs: null,
    lastPersistedAtMs: null,
    lastFilteredClass: null,
  };
}

function emptyFile(nowMs = Date.now()): GenuineTickStoreFile {
  return {
    version: GENUINE_TICK_STORE_FILE_VERSION,
    schemaVersion: GENUINE_TICK_STORE_SCHEMA,
    provider: "FOREXCONNECT",
    updatedAtMs: nowMs,
    nextSequence: 1,
    counters: emptyCounters(),
    byInstrument: {},
    recentDedupeIds: [],
  };
}

function resolveDefaultStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveGenuineTickStorePath(storageRoot?: string): string {
  const root = storageRoot?.trim() || resolveDefaultStorageRoot();
  return path.join(root, "forexconnect", "genuine-ticks.json");
}

function isSafeInstrument(symbol: string): boolean {
  const s = symbol.trim();
  if (!s || s.length > 64) return false;
  if (/[\\\0\n\r\t]/.test(s) || s.includes("..")) return false;
  return /^[A-Za-z0-9./_\-]+$/.test(s);
}

function isValidTick(raw: unknown): raw is GenuineTickRecord {
  if (!raw || typeof raw !== "object") return false;
  const t = raw as Record<string, unknown>;
  if (t.schemaVersion !== GENUINE_TICK_SCHEMA) return false;
  if (typeof t.instrument !== "string" || !isSafeInstrument(t.instrument)) return false;
  for (const k of ["bid", "ask", "mid", "spread", "previousBid", "previousAsk", "receiptTimestampMs", "sequence"] as const) {
    if (typeof t[k] !== "number" || !Number.isFinite(t[k] as number)) return false;
  }
  if (typeof t.dedupeId !== "string" || !t.dedupeId) return false;
  if (t.eventClass !== "BID_ASK_CHANGE" && t.eventClass !== "BID_CHANGE" && t.eventClass !== "ASK_CHANGE") {
    return false;
  }
  if (typeof t.source !== "string") return false;
  if (t.quality !== "OK" && t.quality !== "DEGRADED") return false;
  if (t.eventTimestampMs != null && (typeof t.eventTimestampMs !== "number" || !Number.isFinite(t.eventTimestampMs))) {
    return false;
  }
  return true;
}

function pruneInstrumentTicks(
  ticks: GenuineTickRecord[],
  nowMs: number,
  maxPerInstrument = GENUINE_TICK_MAX_PER_INSTRUMENT,
  maxAgeMs = GENUINE_TICK_MAX_AGE_MS,
): GenuineTickRecord[] {
  const cutoff = nowMs - maxAgeMs;
  let next = ticks.filter((t) => t.receiptTimestampMs >= cutoff);
  if (next.length > maxPerInstrument) {
    next = next.slice(next.length - maxPerInstrument);
  }
  return next;
}

function sanitizeFile(raw: GenuineTickStoreFile, nowMs: number): GenuineTickStoreFile {
  const byInstrument: Record<string, GenuineTickRecord[]> = {};
  for (const [key, rows] of Object.entries(raw.byInstrument ?? {})) {
    if (!isSafeInstrument(key) || !Array.isArray(rows)) continue;
    const valid = rows.filter(isValidTick).sort((a, b) => a.receiptTimestampMs - b.receiptTimestampMs);
    const pruned = pruneInstrumentTicks(valid, nowMs);
    if (pruned.length > 0) byInstrument[key.trim().toUpperCase()] = pruned;
  }
  const dedupe = Array.isArray(raw.recentDedupeIds)
    ? raw.recentDedupeIds.filter((id) => typeof id === "string" && id.length > 0).slice(-GENUINE_TICK_DEDUPE_SET_MAX)
    : [];
  return {
    version: GENUINE_TICK_STORE_FILE_VERSION,
    schemaVersion: GENUINE_TICK_STORE_SCHEMA,
    provider: "FOREXCONNECT",
    updatedAtMs: typeof raw.updatedAtMs === "number" && Number.isFinite(raw.updatedAtMs)
      ? raw.updatedAtMs
      : nowMs,
    nextSequence:
      typeof raw.nextSequence === "number" && Number.isFinite(raw.nextSequence) && raw.nextSequence > 0
        ? Math.floor(raw.nextSequence)
        : 1,
    counters: {
      ...emptyCounters(),
      ...(raw.counters && typeof raw.counters === "object" ? raw.counters : {}),
    },
    byInstrument,
    recentDedupeIds: dedupe,
  };
}

export class GenuineTickStore {
  readonly storePath: string;
  private data: GenuineTickStoreFile;
  private dedupeSet: Set<string>;
  private recoveredCorrupt = false;
  private dirty = false;

  constructor(options?: { storageRoot?: string; storePath?: string }) {
    this.storePath = options?.storePath ?? resolveGenuineTickStorePath(options?.storageRoot);
    this.data = emptyFile();
    this.dedupeSet = new Set();
  }

  get recoveredFromCorrupt(): boolean {
    return this.recoveredCorrupt;
  }

  getCounters(): TickCaptureCounters {
    return { ...this.data.counters };
  }

  load(): { ok: boolean; recoveredCorrupt: boolean; instrumentCount: number; tickCount: number } {
    const nowMs = Date.now();
    const read = readJsonSafeSync<GenuineTickStoreFile>(this.storePath, emptyFile(nowMs), {
      maxBytes: 8_000_000,
    });
    this.recoveredCorrupt = Boolean(read.recovered);
    this.data = sanitizeFile(read.value ?? emptyFile(nowMs), nowMs);
    this.dedupeSet = new Set(this.data.recentDedupeIds);
    let tickCount = 0;
    for (const rows of Object.values(this.data.byInstrument)) tickCount += rows.length;
    return {
      ok: true,
      recoveredCorrupt: this.recoveredCorrupt,
      instrumentCount: Object.keys(this.data.byInstrument).length,
      tickCount,
    };
  }

  private persist(): boolean {
    try {
      this.data.updatedAtMs = Date.now();
      this.data.recentDedupeIds = [...this.dedupeSet].slice(-GENUINE_TICK_DEDUPE_SET_MAX);
      writeJsonAtomicSync(this.storePath, this.data);
      this.data.counters.lastPersistedAtMs = this.data.updatedAtMs;
      this.data.counters.persisted += 1;
      this.dirty = false;
      return true;
    } catch {
      this.data.counters.persistenceFailures += 1;
      return false;
    }
  }

  markReceived(): void {
    this.data.counters.received += 1;
  }

  markFiltered(eventClass: TickCaptureCounters["lastFilteredClass"]): void {
    this.data.counters.filtered += 1;
    this.data.counters.lastFilteredClass = eventClass;
  }

  markProcessingFailure(): void {
    this.data.counters.processingFailures += 1;
  }

  getTicks(instrument: string): GenuineTickRecord[] {
    const key = instrument.trim().toUpperCase();
    return [...(this.data.byInstrument[key] ?? [])];
  }

  getLatest(instrument: string): GenuineTickRecord | null {
    const rows = this.data.byInstrument[instrument.trim().toUpperCase()];
    if (!rows || rows.length === 0) return null;
    return rows[rows.length - 1] ?? null;
  }

  listInstruments(): string[] {
    return Object.keys(this.data.byInstrument).sort();
  }

  /**
   * Append an already-classified genuine tick. Suppresses duplicates by dedupeId.
   * Out-of-order receipts are inserted by receiptTimestampMs order.
   */
  appendGenuineTick(
    partial: Omit<GenuineTickRecord, "schemaVersion" | "sequence">,
    options?: { nowMs?: number; persist?: boolean },
  ): GenuineTickAppendResult {
    const nowMs = options?.nowMs ?? Date.now();
    const persist = options?.persist !== false;
    const instrument = partial.instrument.trim().toUpperCase();
    if (!isSafeInstrument(instrument)) {
      this.data.counters.filtered += 1;
      return {
        accepted: false,
        duplicate: false,
        persisted: false,
        filtered: true,
        record: null,
        reason: "invalid_instrument",
        recoveredCorrupt: this.recoveredCorrupt,
      };
    }
    if (this.dedupeSet.has(partial.dedupeId)) {
      this.data.counters.duplicates += 1;
      return {
        accepted: false,
        duplicate: true,
        persisted: false,
        filtered: true,
        record: null,
        reason: "duplicate_dedupe_id",
        recoveredCorrupt: this.recoveredCorrupt,
      };
    }

    const record: GenuineTickRecord = {
      ...partial,
      instrument,
      schemaVersion: GENUINE_TICK_SCHEMA,
      sequence: this.data.nextSequence++,
    };

    const existing = this.data.byInstrument[instrument] ?? [];
    // Insert ordered by receipt time; identical receipt+prices already deduped.
    let insertAt = existing.length;
    while (insertAt > 0 && existing[insertAt - 1]!.receiptTimestampMs > record.receiptTimestampMs) {
      insertAt -= 1;
    }
    const next = existing.slice();
    next.splice(insertAt, 0, record);
    this.data.byInstrument[instrument] = pruneInstrumentTicks(next, nowMs);
    this.dedupeSet.add(record.dedupeId);
    if (this.dedupeSet.size > GENUINE_TICK_DEDUPE_SET_MAX) {
      const trimmed = [...this.dedupeSet].slice(-GENUINE_TICK_DEDUPE_SET_MAX);
      this.dedupeSet = new Set(trimmed);
    }
    this.data.counters.accepted += 1;
    this.data.counters.lastAcceptedAtMs = record.receiptTimestampMs;
    this.dirty = true;

    let persisted = false;
    if (persist) {
      persisted = this.persist();
    }

    return {
      accepted: true,
      duplicate: false,
      persisted,
      filtered: false,
      record,
      reason: persisted || !persist ? "accepted" : "accepted_persist_failed",
      recoveredCorrupt: this.recoveredCorrupt,
    };
  }

  flush(): boolean {
    if (!this.dirty) return true;
    return this.persist();
  }

  /** Test helper — replace in-memory state without disk I/O. */
  replaceForTests(file: GenuineTickStoreFile): void {
    this.data = sanitizeFile(file, Date.now());
    this.dedupeSet = new Set(this.data.recentDedupeIds);
    this.dirty = false;
  }
}

let singleton: GenuineTickStore | null = null;

export function getGenuineTickStore(options?: { storageRoot?: string }): GenuineTickStore {
  if (!singleton) {
    singleton = new GenuineTickStore(options);
    singleton.load();
  }
  return singleton;
}

export function resetGenuineTickStoreForTests(): void {
  singleton = null;
}

export function createGenuineTickStore(options?: { storageRoot?: string; storePath?: string }): GenuineTickStore {
  const store = new GenuineTickStore(options);
  store.load();
  return store;
}
