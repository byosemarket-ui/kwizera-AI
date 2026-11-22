/**
 * P8.C — immutable Charts prediction evaluation persistence.
 * Under {STORAGE_ROOT}/mt5-hfm/mif/charts-prediction-evaluations/
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HfmChartsPredictionEvaluationRecord } from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveChartsPredictionEvaluationRoot(
  storageRoot = resolveStorageRoot(),
): string {
  return path.join(storageRoot, "mt5-hfm", "mif", "charts-prediction-evaluations");
}

function sanitizeId(id: string): string {
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

/** In-process lock to serialize concurrent duplicate persists for the same evaluationId. */
const persistLocks = new Map<string, Promise<unknown>>();

async function withPersistLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = persistLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const chained = prev.then(() => gate);
  persistLocks.set(
    key,
    chained.then(() => undefined).catch(() => undefined),
  );
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (persistLocks.get(key) === chained) persistLocks.delete(key);
  }
}

export class HfmChartsPredictionOutcomeStorage {
  readonly root: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveChartsPredictionEvaluationRoot(storageRoot);
  }

  evaluationPath(evaluationId: string): string {
    return path.join(this.root, `${sanitizeId(evaluationId)}.json`);
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.root);
  }

  async persistEvaluation(
    record: HfmChartsPredictionEvaluationRecord,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    return withPersistLock(record.evaluationId, async () => {
      await this.ensureLayout();
      const fp = this.evaluationPath(record.evaluationId);
      const existing = await readJsonFile<HfmChartsPredictionEvaluationRecord>(fp);
      if (existing) {
        if (
          existing.evaluationId === record.evaluationId
          && existing.snapshotHash === record.snapshotHash
          && existing.provenance.pitManifestId === record.provenance.pitManifestId
          && existing.provenance.datasetContentHash === record.provenance.datasetContentHash
          && existing.provenance.candleRangeHash === record.provenance.candleRangeHash
          && existing.evaluatorVersion === record.evaluatorVersion
          && existing.resultKind === record.resultKind
          && existing.realizedSignedRMultiple === record.realizedSignedRMultiple
        ) {
          return { ok: true, created: false };
        }
        return {
          ok: false,
          code: "EVALUATION_IMMUTABLE_CONFLICT",
          message: `refusing to mutate immutable charts evaluation ${record.evaluationId}`,
        };
      }
      await atomicWrite(fp, `${JSON.stringify(record, null, 2)}\n`);
      const check = await this.getEvaluation(record.evaluationId);
      if (!check || check.evaluationId !== record.evaluationId) {
        return { ok: false, code: "READBACK_FAILED", message: "evaluation read-after-write failed" };
      }
      return { ok: true, created: true };
    });
  }

  async getEvaluation(
    evaluationId: string,
  ): Promise<HfmChartsPredictionEvaluationRecord | null> {
    return readJsonFile<HfmChartsPredictionEvaluationRecord>(
      this.evaluationPath(evaluationId),
    );
  }

  async listEvaluationsForPrediction(
    predictionId: string,
  ): Promise<HfmChartsPredictionEvaluationRecord[]> {
    await this.ensureLayout();
    const files = await fs.readdir(this.root);
    const out: HfmChartsPredictionEvaluationRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const rec = await readJsonFile<HfmChartsPredictionEvaluationRecord>(
        path.join(this.root, f),
      );
      if (rec && rec.predictionId === predictionId) out.push(rec);
    }
    out.sort((a, b) => a.computationTimestamp.localeCompare(b.computationTimestamp));
    return out;
  }

  async listAllEvaluations(opts?: {
    offset?: number;
    limit?: number;
  }): Promise<{ items: HfmChartsPredictionEvaluationRecord[]; total: number }> {
    await this.ensureLayout();
    const files = await fs.readdir(this.root);
    const all: HfmChartsPredictionEvaluationRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const rec = await readJsonFile<HfmChartsPredictionEvaluationRecord>(
        path.join(this.root, f),
      );
      if (rec) all.push(rec);
    }
    all.sort((a, b) => a.computationTimestamp.localeCompare(b.computationTimestamp));
    const offset = Math.max(0, opts?.offset ?? 0);
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
    return { items: all.slice(offset, offset + limit), total: all.length };
  }
}

let singleton: HfmChartsPredictionOutcomeStorage | null = null;

export function getHfmChartsPredictionOutcomeStorage(
  storageRoot?: string,
): HfmChartsPredictionOutcomeStorage {
  if (storageRoot) return new HfmChartsPredictionOutcomeStorage(storageRoot);
  if (!singleton) singleton = new HfmChartsPredictionOutcomeStorage();
  return singleton;
}

export function __setHfmChartsPredictionOutcomeStorageForTests(
  storage: HfmChartsPredictionOutcomeStorage | null,
): void {
  singleton = storage;
}
