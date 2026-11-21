/**
 * Phase 5F STEP 5 Phase C — immutable WF calibration run persistence.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { MIF_WF_CALIBRATION_MAX_RUNS_LIST } from "./contracts.js";
import type {
  MifWfCalibrationEvidenceDoc,
  MifWfCalibrationRun,
} from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveWfCalibrationRoot(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "mif", "wf-calibration-runs");
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

export class MifWfCalibrationStorage {
  readonly root: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveWfCalibrationRoot(storageRoot);
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.root);
  }

  runDir(runId: string): string {
    return path.join(this.root, sanitizeId(runId));
  }

  async persistRun(
    run: MifWfCalibrationRun,
    evidence: MifWfCalibrationEvidenceDoc,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const dir = this.runDir(run.runId);
    const manifestPath = path.join(dir, "manifest.json");
    const existing = await readJsonFile<MifWfCalibrationRun>(manifestPath);
    if (existing) {
      if (existing.runHash === run.runHash) return { ok: true, created: false };
      return {
        ok: false,
        code: "RUN_IMMUTABLE_CONFLICT",
        message: `refusing overwrite of WF calibration ${run.runId}`,
      };
    }
    await ensureDir(dir);
    await atomicWrite(path.join(dir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await atomicWrite(manifestPath, `${JSON.stringify(run, null, 2)}\n`);
    return { ok: true, created: true };
  }

  async getRun(runId: string): Promise<MifWfCalibrationRun | null> {
    return readJsonFile<MifWfCalibrationRun>(path.join(this.runDir(runId), "manifest.json"));
  }

  async getEvidence(runId: string): Promise<MifWfCalibrationEvidenceDoc | null> {
    return readJsonFile<MifWfCalibrationEvidenceDoc>(
      path.join(this.runDir(runId), "evidence.json"),
    );
  }

  async listRuns(filter?: {
    offset?: number;
    limit?: number;
  }): Promise<{ items: MifWfCalibrationRun[]; total: number }> {
    await this.ensureLayout();
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const items: MifWfCalibrationRun[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const m = await this.getRun(e.name);
      if (m) items.push(m);
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = items.length;
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.min(
      MIF_WF_CALIBRATION_MAX_RUNS_LIST,
      Math.max(1, filter?.limit ?? 20),
    );
    return { items: items.slice(offset, offset + limit), total };
  }
}

let _store: MifWfCalibrationStorage | null = null;

export function getMifWfCalibrationStorage(storageRoot?: string): MifWfCalibrationStorage {
  if (storageRoot) return new MifWfCalibrationStorage(storageRoot);
  if (!_store) _store = new MifWfCalibrationStorage();
  return _store;
}

export function __setMifWfCalibrationStorageForTests(
  store: MifWfCalibrationStorage | null,
): void {
  _store = store;
}
