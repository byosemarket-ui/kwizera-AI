/**
 * Stage 6 — Persist dry-run / blocked adapter attempts (idempotency).
 * Never records a real broker submission in this stage.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import {
  AT_DEMO_ADAPTER_PHASE,
  AT_DEMO_ADAPTER_SCHEMA,
  AT_DEMO_ADAPTER_STAGE,
  DEMO_ADAPTER_SUBMISSION_MODE,
  type DemoAdapterAttemptRecord,
} from "./types.js";

const MAX_HISTORY = 80;

interface StoreFile {
  schemaVersion: typeof AT_DEMO_ADAPTER_SCHEMA;
  stage: typeof AT_DEMO_ADAPTER_STAGE;
  phase: typeof AT_DEMO_ADAPTER_PHASE;
  submissionMode: typeof DEMO_ADAPTER_SUBMISSION_MODE;
  byIdempotencyKey: Record<string, string>;
  history: DemoAdapterAttemptRecord[];
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "demo-submission-adapter.json",
  );
}

function empty(): StoreFile {
  return {
    schemaVersion: AT_DEMO_ADAPTER_SCHEMA,
    stage: AT_DEMO_ADAPTER_STAGE,
    phase: AT_DEMO_ADAPTER_PHASE,
    submissionMode: DEMO_ADAPTER_SUBMISSION_MODE,
    byIdempotencyKey: {},
    history: [],
  };
}

function normalize(raw: unknown): StoreFile {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as DemoAdapterAttemptRecord[])
      .filter((r) => r && typeof r === "object" && typeof r.executionAttemptId === "string")
      .slice(0, MAX_HISTORY)
    : [];
  const byIdempotencyKey: Record<string, string> = {};
  if (o.byIdempotencyKey && typeof o.byIdempotencyKey === "object") {
    for (const [k, v] of Object.entries(o.byIdempotencyKey as Record<string, unknown>)) {
      if (typeof v === "string" && v) byIdempotencyKey[k] = v;
    }
  }
  for (const row of history) {
    if (row.idempotencyKey && !byIdempotencyKey[row.idempotencyKey]) {
      byIdempotencyKey[row.idempotencyKey] = row.executionAttemptId;
    }
  }
  return {
    ...base,
    byIdempotencyKey,
    history,
  };
}

export class DemoSubmissionAdapterStore {
  private data: StoreFile;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  private persist(): void {
    writeJsonAtomicSync(this.file, this.data);
  }

  latest(): DemoAdapterAttemptRecord | null {
    return this.data.history[0] ?? null;
  }

  list(limit = 40): DemoAdapterAttemptRecord[] {
    return this.data.history.slice(0, Math.max(1, Math.min(MAX_HISTORY, limit)));
  }

  getByIdempotencyKey(key: string): DemoAdapterAttemptRecord | null {
    const id = this.data.byIdempotencyKey[key];
    if (!id) return null;
    return this.data.history.find((h) => h.executionAttemptId === id) ?? null;
  }

  hasSuccessfulSubmissionForProposal(_proposalId: string): boolean {
    // Stage 6 never records successful broker submissions.
    return false;
  }

  /**
   * Idempotent upsert: same idempotency key returns existing record (duplicate=true).
   */
  upsertAttempt(record: DemoAdapterAttemptRecord): {
    record: DemoAdapterAttemptRecord;
    duplicate: boolean;
  } {
    const existing = this.getByIdempotencyKey(record.idempotencyKey);
    if (existing) {
      return { record: existing, duplicate: true };
    }
    this.data.byIdempotencyKey[record.idempotencyKey] = record.executionAttemptId;
    this.data.history = [record, ...this.data.history].slice(0, MAX_HISTORY);
    this.persist();
    return { record, duplicate: false };
  }
}

let singleton: DemoSubmissionAdapterStore | null = null;

export function getDemoSubmissionAdapterStore(storageRoot?: string): DemoSubmissionAdapterStore {
  if (storageRoot) return new DemoSubmissionAdapterStore(storageRoot);
  if (!singleton) singleton = new DemoSubmissionAdapterStore();
  return singleton;
}

export function resetDemoSubmissionAdapterStoreForTests(storageRoot?: string): DemoSubmissionAdapterStore {
  singleton = new DemoSubmissionAdapterStore(storageRoot);
  return singleton;
}
