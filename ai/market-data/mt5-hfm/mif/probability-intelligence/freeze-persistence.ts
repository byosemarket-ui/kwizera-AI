/**
 * Phase 5F STEP 5 Phase B — immutable probability freeze persistence.
 * Create-only; identical hash = idempotent; conflicting content = refuse overwrite.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  MIF_PROBABILITY_FREEZE_DEFAULT_API_LIST,
  MIF_PROBABILITY_FREEZE_MAX_API_LIST,
} from "./freeze-contracts.js";
import type { MifProbabilityFreezeRecord } from "./freeze-types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveProbabilityFreezeRoot(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "mif", "probability-freezes");
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

export class MifProbabilityFreezeStorage {
  readonly root: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveProbabilityFreezeRoot(storageRoot);
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.root);
  }

  freezePath(freezeId: string): string {
    return path.join(this.root, `${sanitizeId(freezeId)}.json`);
  }

  /**
   * Persist immutable freeze. Same freezeId + freezeHash → idempotent.
   * Same freezeId + different hash → refuse (never overwrite).
   */
  async persistFreeze(
    freeze: MifProbabilityFreezeRecord,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const fp = this.freezePath(freeze.freezeId);
    const existing = await readJsonFile<MifProbabilityFreezeRecord>(fp);
    if (existing) {
      if (existing.freezeHash === freeze.freezeHash) {
        return { ok: true, created: false };
      }
      return {
        ok: false,
        code: "FREEZE_IMMUTABLE_CONFLICT",
        message: `refusing overwrite of immutable freeze ${freeze.freezeId}`,
      };
    }
    await atomicWrite(fp, `${JSON.stringify(freeze, null, 2)}\n`);
    const check = await this.getFreeze(freeze.freezeId);
    if (!check || check.freezeHash !== freeze.freezeHash) {
      return { ok: false, code: "READBACK_FAILED", message: "freeze read-after-write failed" };
    }
    return { ok: true, created: true };
  }

  async getFreeze(freezeId: string): Promise<MifProbabilityFreezeRecord | null> {
    return readJsonFile<MifProbabilityFreezeRecord>(this.freezePath(freezeId));
  }

  async getFreezeForAssessment(
    assessmentId: string,
  ): Promise<MifProbabilityFreezeRecord | null> {
    const listed = await this.listFreezes({ assessmentId, limit: 50 });
    if (!listed.items.length) return null;
    // Prefer highest revisionOrdinal for this assessment.
    return listed.items.reduce((a, b) =>
      b.revisionOrdinal >= a.revisionOrdinal ? b : a,
    );
  }

  async listFreezes(filter?: {
    assessmentId?: string;
    predictionId?: string;
    providerSymbol?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ items: MifProbabilityFreezeRecord[]; total: number }> {
    await this.ensureLayout();
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.root)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifProbabilityFreezeRecord[] = [];
    for (const name of names) {
      const rec = await readJsonFile<MifProbabilityFreezeRecord>(path.join(this.root, name));
      if (!rec) continue;
      if (filter?.assessmentId && rec.assessmentId !== filter.assessmentId) continue;
      if (filter?.predictionId && rec.predictionId !== filter.predictionId) continue;
      if (
        filter?.providerSymbol
        && rec.providerSymbol.toUpperCase() !== filter.providerSymbol.toUpperCase()
      ) {
        continue;
      }
      items.push(rec);
    }
    items.sort((a, b) => b.frozenAt.localeCompare(a.frozenAt));
    const total = items.length;
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.min(
      MIF_PROBABILITY_FREEZE_MAX_API_LIST,
      Math.max(1, filter?.limit ?? MIF_PROBABILITY_FREEZE_DEFAULT_API_LIST),
    );
    return { items: items.slice(offset, offset + limit), total };
  }
}

let _store: MifProbabilityFreezeStorage | null = null;

export function getMifProbabilityFreezeStorage(
  storageRoot?: string,
): MifProbabilityFreezeStorage {
  if (storageRoot) return new MifProbabilityFreezeStorage(storageRoot);
  if (!_store) _store = new MifProbabilityFreezeStorage();
  return _store;
}

export function __setMifProbabilityFreezeStorageForTests(
  store: MifProbabilityFreezeStorage | null,
): void {
  _store = store;
}
