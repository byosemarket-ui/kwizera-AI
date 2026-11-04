/**
 * Step 3 — Persist broker handoff packages (atomic, idempotent).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import {
  AT_BROKER_HANDOFF_MAX_HISTORY,
  AT_BROKER_HANDOFF_PHASE,
  AT_BROKER_HANDOFF_SCHEMA,
  type AtBrokerHandoffRecord,
  type AtBrokerHandoffStoreFile,
} from "./types.js";
import { isHandoffExpired } from "./engine.js";

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "broker-handoffs.json",
  );
}

function normalize(raw: unknown): AtBrokerHandoffStoreFile {
  const empty: AtBrokerHandoffStoreFile = {
    schemaVersion: AT_BROKER_HANDOFF_SCHEMA,
    phase: AT_BROKER_HANDOFF_PHASE,
    latestId: null,
    byIdempotencyKey: {},
    history: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as AtBrokerHandoffRecord[])
      .filter((x) => x && typeof x === "object" && x.provenance?.handoffId)
      .slice(0, AT_BROKER_HANDOFF_MAX_HISTORY)
    : [];
  const byIdempotencyKey: Record<string, string> = {};
  if (o.byIdempotencyKey && typeof o.byIdempotencyKey === "object") {
    for (const [k, v] of Object.entries(o.byIdempotencyKey as Record<string, unknown>)) {
      if (typeof v === "string" && v) byIdempotencyKey[k] = v;
    }
  }
  for (const row of history) {
    if (row.idempotencyKey && row.provenance?.handoffId && !byIdempotencyKey[row.idempotencyKey]) {
      byIdempotencyKey[row.idempotencyKey] = row.provenance.handoffId;
    }
  }
  return {
    schemaVersion: AT_BROKER_HANDOFF_SCHEMA,
    phase: AT_BROKER_HANDOFF_PHASE,
    latestId:
      typeof o.latestId === "string"
        ? o.latestId
        : history[0]?.provenance.handoffId ?? null,
    byIdempotencyKey,
    history,
  };
}

export class AtBrokerHandoffStore {
  private data: AtBrokerHandoffStoreFile;
  private readonly file: string;
  lastWriteError: string | null = null;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  latest(): AtBrokerHandoffRecord | null {
    if (!this.data.latestId) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.provenance.handoffId === this.data.latestId)
      ?? this.data.history[0]
      ?? null;
  }

  get(id: string): AtBrokerHandoffRecord | null {
    return this.data.history.find((h) => h.provenance.handoffId === id) ?? null;
  }

  getByIdempotencyKey(key: string): AtBrokerHandoffRecord | null {
    const id = this.data.byIdempotencyKey[key];
    return id ? this.get(id) : null;
  }

  list(limit = 12): AtBrokerHandoffRecord[] {
    return this.data.history.slice(0, Math.max(1, Math.min(80, limit)));
  }

  countReady(): number {
    return this.data.history.filter((h) => h.lifecycle === "HANDOFF_READY").length;
  }

  upsertHandoff(record: AtBrokerHandoffRecord): {
    record: AtBrokerHandoffRecord;
    duplicate: boolean;
  } {
    const existingId = this.data.byIdempotencyKey[record.idempotencyKey];
    if (existingId) {
      const existing = this.get(existingId);
      if (
        existing
        && (existing.lifecycle === "HANDOFF_READY"
          || existing.lifecycle === "BLOCKED"
          || existing.lifecycle === "VALIDATING"
          || existing.lifecycle === "BROKER_COMPATIBLE"
          || existing.lifecycle === "RECEIVED")
      ) {
        // Expired ready packages must not be reused as active.
        if (existing.lifecycle === "HANDOFF_READY" && isHandoffExpired(existing)) {
          existing.lifecycle = "EXPIRED";
          existing.updatedAtUtc = new Date().toISOString();
          existing.provenance.updatedAtUtc = existing.updatedAtUtc;
        } else {
          return { record: existing, duplicate: true };
        }
      }
      if (existing && existing.lifecycle === "HANDOFF_READY") {
        existing.lifecycle = "SUPERSEDED";
        existing.updatedAtUtc = new Date().toISOString();
      }
    }

    // Supersede other READY handoffs for same proposal
    if (record.lifecycle === "HANDOFF_READY" && record.provenance.proposalId) {
      for (const h of this.data.history) {
        if (
          h.provenance.handoffId !== record.provenance.handoffId
          && h.provenance.proposalId === record.provenance.proposalId
          && h.lifecycle === "HANDOFF_READY"
        ) {
          h.lifecycle = "SUPERSEDED";
          h.updatedAtUtc = new Date().toISOString();
        }
      }
    }

    this.data.history = [
      record,
      ...this.data.history.filter((h) => h.provenance.handoffId !== record.provenance.handoffId),
    ].slice(0, AT_BROKER_HANDOFF_MAX_HISTORY);
    this.data.byIdempotencyKey[record.idempotencyKey] = record.provenance.handoffId;
    this.data.latestId = record.provenance.handoffId;
    this.persist();
    return { record, duplicate: false };
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      writeJsonAtomicSync(this.file, this.data);
      this.lastWriteError = null;
    } catch (err) {
      this.lastWriteError = err instanceof Error ? err.message : String(err);
    }
  }
}

let singleton: AtBrokerHandoffStore | null = null;
const byRoot = new Map<string, AtBrokerHandoffStore>();

export function getAtBrokerHandoffStore(storageRoot?: string): AtBrokerHandoffStore {
  if (storageRoot) {
    const existing = byRoot.get(storageRoot);
    if (existing) return existing;
    const created = new AtBrokerHandoffStore(storageRoot);
    byRoot.set(storageRoot, created);
    return created;
  }
  if (!singleton) singleton = new AtBrokerHandoffStore();
  return singleton;
}

export function resetAtBrokerHandoffStoreForTests(): void {
  singleton = null;
  byRoot.clear();
}
