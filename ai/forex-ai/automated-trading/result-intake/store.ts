/**
 * Phase 4.18G.1 — Persist analysis result-intake history (atomic, corruption-safe).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import {
  AT_RESULT_INTAKE_MAX_HISTORY,
  AT_RESULT_INTAKE_PHASE,
  AT_RESULT_INTAKE_SCHEMA,
  type AtResultIntakeRecord,
  type AtResultIntakeStoreFile,
} from "./types.js";

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "analysis-result-intake.json",
  );
}

function normalize(raw: unknown): AtResultIntakeStoreFile {
  const empty: AtResultIntakeStoreFile = {
    schemaVersion: AT_RESULT_INTAKE_SCHEMA,
    phase: AT_RESULT_INTAKE_PHASE,
    latestId: null,
    byIdempotencyKey: {},
    history: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as AtResultIntakeRecord[])
      .filter((x) => x && typeof x === "object" && typeof x.resultId === "string")
      .slice(0, AT_RESULT_INTAKE_MAX_HISTORY)
    : [];
  const byIdempotencyKey: Record<string, string> = {};
  if (o.byIdempotencyKey && typeof o.byIdempotencyKey === "object") {
    for (const [k, v] of Object.entries(o.byIdempotencyKey as Record<string, unknown>)) {
      if (typeof v === "string" && v) byIdempotencyKey[k] = v;
    }
  }
  for (const row of history) {
    if (row.idempotencyKey && row.resultId && !byIdempotencyKey[row.idempotencyKey]) {
      byIdempotencyKey[row.idempotencyKey] = row.resultId;
    }
  }
  return {
    schemaVersion: AT_RESULT_INTAKE_SCHEMA,
    phase: AT_RESULT_INTAKE_PHASE,
    latestId: typeof o.latestId === "string" ? o.latestId : history[0]?.resultId ?? null,
    byIdempotencyKey,
    history,
  };
}

export class AtResultIntakeStore {
  private data: AtResultIntakeStoreFile;
  private readonly file: string;
  lastWriteError: string | null = null;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  latest(): AtResultIntakeRecord | null {
    if (!this.data.latestId) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.resultId === this.data.latestId)
      ?? this.data.history[0]
      ?? null;
  }

  get(id: string): AtResultIntakeRecord | null {
    return this.data.history.find((h) => h.resultId === id) ?? null;
  }

  getByIdempotencyKey(key: string): AtResultIntakeRecord | null {
    const id = this.data.byIdempotencyKey[key];
    return id ? this.get(id) : null;
  }

  list(limit = 12): AtResultIntakeRecord[] {
    const n = Math.max(1, Math.min(AT_RESULT_INTAKE_MAX_HISTORY, Math.floor(limit)));
    return this.data.history.slice(0, n);
  }

  count(): number {
    return this.data.history.length;
  }

  countAcceptedDirectional(): number {
    return this.data.history.filter(
      (h) =>
        h.intakeLifecycle === "ACCEPTED"
        && h.eligibleForOrderPreparation
        && (h.decision === "BUY" || h.decision === "SELL"),
    ).length;
  }

  /**
   * Append immutable history row. Duplicate idempotency keys return the existing record.
   * When a new ACCEPTED row arrives for the same instrument, prior ACCEPTED rows become SUPERSEDED.
   */
  async save(
    record: AtResultIntakeRecord,
  ): Promise<{ saved: boolean; duplicate: boolean; record: AtResultIntakeRecord }> {
    const existingId = this.data.byIdempotencyKey[record.idempotencyKey];
    if (existingId) {
      const existing = this.get(existingId);
      if (existing) {
        return { saved: false, duplicate: true, record: existing };
      }
    }

    let history = [...this.data.history];
    let next = { ...record };

    if (next.intakeLifecycle === "ACCEPTED" && next.instrument) {
      history = history.map((row) => {
        if (
          row.instrument === next.instrument
          && row.intakeLifecycle === "ACCEPTED"
          && row.resultId !== next.resultId
        ) {
          return {
            ...row,
            intakeLifecycle: "SUPERSEDED" as const,
            supersededByResultId: next.resultId,
            eligibleForOrderPreparation: false,
          };
        }
        return row;
      });
      const prior = history.find(
        (r) =>
          r.instrument === next.instrument
          && r.supersededByResultId === next.resultId,
      );
      if (prior) {
        next = { ...next, supersedesResultId: prior.resultId };
      }
    }

    history = [next, ...history].slice(0, AT_RESULT_INTAKE_MAX_HISTORY);
    this.data = {
      schemaVersion: AT_RESULT_INTAKE_SCHEMA,
      phase: AT_RESULT_INTAKE_PHASE,
      latestId: next.resultId,
      byIdempotencyKey: {
        ...this.data.byIdempotencyKey,
        [next.idempotencyKey]: next.resultId,
      },
      history,
    };
    try {
      await writeJsonAtomic(this.file, this.data);
      this.lastWriteError = null;
      return { saved: true, duplicate: false, record: next };
    } catch (err) {
      this.lastWriteError = err instanceof Error ? err.message.slice(0, 200) : "write_failed";
      return { saved: false, duplicate: false, record: next };
    }
  }
}

let singleton: AtResultIntakeStore | null = null;

export function getAtResultIntakeStore(storageRoot?: string): AtResultIntakeStore {
  if (storageRoot) return new AtResultIntakeStore(storageRoot);
  if (!singleton) singleton = new AtResultIntakeStore();
  return singleton;
}

export function resetAtResultIntakeStoreForTests(): void {
  singleton = null;
}
