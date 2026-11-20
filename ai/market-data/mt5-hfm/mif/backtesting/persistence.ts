/**
 * Phase 5F STEP 4 — immutable backtest run persistence.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { MifBacktestRunManifest, MifBacktestRunRecord } from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveBacktestRoot(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "mif", "backtests");
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

export class MifBacktestStorage {
  readonly root: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveBacktestRoot(storageRoot);
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.root);
  }

  runDir(runId: string): string {
    return path.join(this.root, sanitizeId(runId));
  }

  async persistRun(
    record: MifBacktestRunRecord,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const dir = this.runDir(record.manifest.runId);
    const manifestPath = path.join(dir, "manifest.json");
    const existing = await readJsonFile<MifBacktestRunManifest>(manifestPath);
    if (existing) {
      if (existing.runHash === record.manifest.runHash) {
        return { ok: true, created: false };
      }
      return {
        ok: false,
        code: "RUN_EXISTS",
        message: `refusing overwrite of immutable backtest ${record.manifest.runId}`,
      };
    }
    await ensureDir(dir);
    // Bound tips payload — store compact tip summary + full manifest
    const tipsCompact = record.tips.map((t) => ({
      tipOpenTimeSec: t.tipOpenTimeSec,
      decisionTimeSec: t.decisionTimeSec,
      candidateId: t.candidateId,
      predictionId: t.predictionId,
      skippedDuplicate: t.skippedDuplicate,
      skippedOverlap: t.skippedOverlap,
      outcomeId: t.outcome?.outcomeId ?? null,
      levelResult: t.outcome?.levelOutcome.resultKind ?? null,
      completeness: t.outcome?.completeness ?? null,
      outcomeError: t.outcomeError,
      snapshotHash: t.snapshot.snapshotHash,
    }));
    await atomicWrite(
      path.join(dir, "tips.json"),
      `${JSON.stringify({ tips: tipsCompact }, null, 2)}\n`,
    );
    await atomicWrite(
      path.join(dir, "folds.json"),
      `${JSON.stringify({ folds: record.manifest.folds }, null, 2)}\n`,
    );
    await atomicWrite(manifestPath, `${JSON.stringify(record.manifest, null, 2)}\n`);
    const check = await this.getManifest(record.manifest.runId);
    if (!check || check.runHash !== record.manifest.runHash) {
      return { ok: false, code: "READBACK_FAILED", message: "backtest read-after-write failed" };
    }
    return { ok: true, created: true };
  }

  async getManifest(runId: string): Promise<MifBacktestRunManifest | null> {
    return readJsonFile<MifBacktestRunManifest>(
      path.join(this.runDir(runId), "manifest.json"),
    );
  }

  async getFolds(runId: string): Promise<MifBacktestRunManifest["folds"] | null> {
    const doc = await readJsonFile<{ folds: MifBacktestRunManifest["folds"] }>(
      path.join(this.runDir(runId), "folds.json"),
    );
    if (doc?.folds) return doc.folds;
    const m = await this.getManifest(runId);
    return m?.folds ?? null;
  }

  async listRuns(filter?: {
    offset?: number;
    limit?: number;
  }): Promise<{ items: MifBacktestRunManifest[]; total: number }> {
    await this.ensureLayout();
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const items: MifBacktestRunManifest[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const m = await this.getManifest(e.name);
      if (m) items.push(m);
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = items.length;
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.min(50, Math.max(1, filter?.limit ?? 20));
    return { items: items.slice(offset, offset + limit), total };
  }
}

let _store: MifBacktestStorage | null = null;

export function getMifBacktestStorage(storageRoot?: string): MifBacktestStorage {
  if (storageRoot) return new MifBacktestStorage(storageRoot);
  if (!_store) _store = new MifBacktestStorage();
  return _store;
}

export function __setMifBacktestStorageForTests(store: MifBacktestStorage | null): void {
  _store = store;
}
