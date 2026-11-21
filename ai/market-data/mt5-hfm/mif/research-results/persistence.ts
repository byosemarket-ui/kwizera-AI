/**
 * Phase 5F STEP 5 Phase B — immutable Research Results summary persistence.
 * Idempotent on identical summaryHash; refuse conflicting overwrite.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { MIF_RESEARCH_RESULTS_MAX_API_LIST } from "./contracts.js";
import type { MifResearchResultSummary } from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveResearchResultsRoot(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "mif", "research-results");
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

export class MifResearchResultsStorage {
  readonly root: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveResearchResultsRoot(storageRoot);
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.root);
  }

  summaryPath(summaryId: string): string {
    return path.join(this.root, `${sanitizeId(summaryId)}.json`);
  }

  async persistSummary(
    summary: MifResearchResultSummary,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const sp = this.summaryPath(summary.summaryId);
    const existing = await readJsonFile<MifResearchResultSummary>(sp);
    if (existing) {
      if (existing.summaryHash === summary.summaryHash) {
        return { ok: true, created: false };
      }
      return {
        ok: false,
        code: "SUMMARY_IMMUTABLE_CONFLICT",
        message: `refusing overwrite of research summary ${summary.summaryId}`,
      };
    }
    await atomicWrite(sp, `${JSON.stringify(summary, null, 2)}\n`);
    const check = await this.getSummary(summary.summaryId);
    if (!check || check.summaryHash !== summary.summaryHash) {
      return { ok: false, code: "READBACK_FAILED", message: "summary read-after-write failed" };
    }
    return { ok: true, created: true };
  }

  async getSummary(summaryId: string): Promise<MifResearchResultSummary | null> {
    return readJsonFile<MifResearchResultSummary>(this.summaryPath(summaryId));
  }

  async listSummaries(filter?: {
    offset?: number;
    limit?: number;
  }): Promise<{ items: MifResearchResultSummary[]; total: number }> {
    await this.ensureLayout();
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.root)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifResearchResultSummary[] = [];
    for (const name of names) {
      const rec = await readJsonFile<MifResearchResultSummary>(path.join(this.root, name));
      if (rec) items.push(rec);
    }
    items.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const total = items.length;
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.min(
      MIF_RESEARCH_RESULTS_MAX_API_LIST,
      Math.max(1, filter?.limit ?? 20),
    );
    return { items: items.slice(offset, offset + limit), total };
  }
}

let _store: MifResearchResultsStorage | null = null;

export function getMifResearchResultsStorage(
  storageRoot?: string,
): MifResearchResultsStorage {
  if (storageRoot) return new MifResearchResultsStorage(storageRoot);
  if (!_store) _store = new MifResearchResultsStorage();
  return _store;
}

export function __setMifResearchResultsStorageForTests(
  store: MifResearchResultsStorage | null,
): void {
  _store = store;
}
