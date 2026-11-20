/**
 * Phase 5F STEP 3 — immutable prediction snapshot / outcome persistence.
 * Under {STORAGE_ROOT}/mt5-hfm/mif/{prediction-snapshots,prediction-outcomes,performance-summaries}/
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { MifPredictionOutcomeRecord, MifPredictionSnapshot } from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolvePredictionOutcomeRoot(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "mif");
}

function sanitizeId(id: string): string {
  // Windows forbids ':' in filenames — replace reserved chars while keeping readability.
  return String(id || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, filePath);
  } catch {
    try {
      await fs.unlink(filePath);
    } catch {
      /* ignore */
    }
    await fs.rename(tmp, filePath);
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

export class MifPredictionOutcomeStorage {
  readonly root: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolvePredictionOutcomeRoot(storageRoot);
  }

  snapshotsDir(): string {
    return path.join(this.root, "prediction-snapshots");
  }
  outcomesDir(): string {
    return path.join(this.root, "prediction-outcomes");
  }
  performanceDir(): string {
    return path.join(this.root, "performance-summaries");
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.snapshotsDir());
    await ensureDir(this.outcomesDir());
    await ensureDir(this.performanceDir());
  }

  snapshotPath(predictionId: string): string {
    return path.join(this.snapshotsDir(), `${sanitizeId(predictionId)}.json`);
  }

  outcomePath(outcomeId: string): string {
    return path.join(this.outcomesDir(), `${sanitizeId(outcomeId)}.json`);
  }

  /**
   * Persist immutable snapshot. Identical hash = idempotent OK.
   * Different content for same predictionId = refuse (do not silently change).
   */
  async persistSnapshot(
    snapshot: MifPredictionSnapshot,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const sp = this.snapshotPath(snapshot.predictionId);
    const existing = await readJsonFile<MifPredictionSnapshot>(sp);
    if (existing) {
      if (existing.snapshotHash === snapshot.snapshotHash) {
        return { ok: true, created: false };
      }
      return {
        ok: false,
        code: "SNAPSHOT_IMMUTABLE_CONFLICT",
        message: `refusing to change existing snapshot ${snapshot.predictionId}`,
      };
    }
    await atomicWrite(sp, `${JSON.stringify(snapshot, null, 2)}\n`);
    const check = await this.getSnapshot(snapshot.predictionId);
    if (!check || check.snapshotHash !== snapshot.snapshotHash) {
      return { ok: false, code: "READBACK_FAILED", message: "snapshot read-after-write failed" };
    }
    return { ok: true, created: true };
  }

  async getSnapshot(predictionId: string): Promise<MifPredictionSnapshot | null> {
    return readJsonFile<MifPredictionSnapshot>(this.snapshotPath(predictionId));
  }

  /**
   * Persist immutable outcome. Idempotent on identical outcomeId.
   * Conflicting content for same outcomeId → fail safely.
   * New candleRangeHash → new outcomeId (revision) by engine; never overwrite.
   */
  async persistOutcome(
    outcome: MifPredictionOutcomeRecord,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const op = this.outcomePath(outcome.outcomeId);
    const existing = await readJsonFile<MifPredictionOutcomeRecord>(op);
    if (existing) {
      if (
        existing.candleRangeHash === outcome.candleRangeHash
        && existing.snapshotHash === outcome.snapshotHash
        && existing.evaluatorVersion === outcome.evaluatorVersion
        && existing.policyVersion === outcome.policyVersion
      ) {
        return { ok: true, created: false };
      }
      return {
        ok: false,
        code: "OUTCOME_IMMUTABLE_CONFLICT",
        message: `conflicting immutable outcome record ${outcome.outcomeId}`,
      };
    }
    // Assign revision ordinal among this prediction's outcomes.
    const siblings = await this.listOutcomesForPrediction(outcome.predictionId);
    const withRev: MifPredictionOutcomeRecord = {
      ...outcome,
      revisionOrdinal: siblings.length + 1,
    };
    await atomicWrite(op, `${JSON.stringify(withRev, null, 2)}\n`);
    const check = await this.getOutcome(outcome.outcomeId);
    if (!check || check.candleRangeHash !== outcome.candleRangeHash) {
      return { ok: false, code: "READBACK_FAILED", message: "outcome read-after-write failed" };
    }
    return { ok: true, created: true };
  }

  async getOutcome(outcomeId: string): Promise<MifPredictionOutcomeRecord | null> {
    return readJsonFile<MifPredictionOutcomeRecord>(this.outcomePath(outcomeId));
  }

  async listOutcomesForPrediction(
    predictionId: string,
  ): Promise<MifPredictionOutcomeRecord[]> {
    await this.ensureLayout();
    const files = await fs.readdir(this.outcomesDir());
    const out: MifPredictionOutcomeRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const rec = await readJsonFile<MifPredictionOutcomeRecord>(
        path.join(this.outcomesDir(), f),
      );
      if (rec && rec.predictionId === predictionId) out.push(rec);
    }
    out.sort((a, b) => a.revisionOrdinal - b.revisionOrdinal);
    return out;
  }

  /**
   * Latest eligible revision: highest revisionOrdinal for the prediction.
   * Multiple revisions of one prediction count as one prediction in aggregation.
   */
  async getLatestOutcomeForPrediction(
    predictionId: string,
  ): Promise<MifPredictionOutcomeRecord | null> {
    const all = await this.listOutcomesForPrediction(predictionId);
    if (!all.length) return null;
    return all.reduce((a, b) => (b.revisionOrdinal >= a.revisionOrdinal ? b : a));
  }

  async listAllOutcomes(filter?: {
    predictionId?: string;
    marketSourceMode?: string;
  }): Promise<MifPredictionOutcomeRecord[]> {
    await this.ensureLayout();
    const files = await fs.readdir(this.outcomesDir());
    const items: MifPredictionOutcomeRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const rec = await readJsonFile<MifPredictionOutcomeRecord>(
        path.join(this.outcomesDir(), f),
      );
      if (!rec) continue;
      if (filter?.predictionId && rec.predictionId !== filter.predictionId) continue;
      if (filter?.marketSourceMode && rec.marketSourceMode !== filter.marketSourceMode) {
        continue;
      }
      items.push(rec);
    }
    items.sort((a, b) => b.computationTimestamp.localeCompare(a.computationTimestamp));
    return items;
  }

  async listOutcomes(filter?: {
    predictionId?: string;
    instrument?: string;
    marketSourceMode?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ items: MifPredictionOutcomeRecord[]; total: number }> {
    const items = await this.listAllOutcomes({
      predictionId: filter?.predictionId,
      marketSourceMode: filter?.marketSourceMode,
    });
    const total = items.length;
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.min(100, Math.max(1, filter?.limit ?? 50));
    return { items: items.slice(offset, offset + limit), total };
  }

  async persistPerformanceSummary(summary: unknown, summaryId: string): Promise<void> {
    await this.ensureLayout();
    await atomicWrite(
      path.join(this.performanceDir(), `${sanitizeId(summaryId)}.json`),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
  }
}

let _store: MifPredictionOutcomeStorage | null = null;

export function getMifPredictionOutcomeStorage(
  storageRoot?: string,
): MifPredictionOutcomeStorage {
  if (storageRoot) return new MifPredictionOutcomeStorage(storageRoot);
  if (!_store) _store = new MifPredictionOutcomeStorage();
  return _store;
}

export function __setMifPredictionOutcomeStorageForTests(
  store: MifPredictionOutcomeStorage | null,
): void {
  _store = store;
}
