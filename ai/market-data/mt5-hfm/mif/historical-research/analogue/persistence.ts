/**
 * Phase 5F STEP 2 — immutable analogue search persistence under research root.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveResearchRoot, sanitizeResearchStorageId } from "../storage.js";
import type { MifAnalogueSearchRecord } from "./types.js";

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

export class MifAnalogueSearchStorage {
  readonly root: string;

  constructor(storageRoot?: string) {
    this.root = resolveResearchRoot(storageRoot);
  }

  searchesDir(): string {
    return path.join(this.root, "analogue-searches");
  }
  resultsDir(): string {
    return path.join(this.root, "analogue-results");
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.searchesDir());
    await ensureDir(this.resultsDir());
  }

  searchPath(searchId: string): string {
    return path.join(this.searchesDir(), `${sanitizeResearchStorageId(searchId)}.json`);
  }

  resultsPath(searchId: string): string {
    return path.join(this.resultsDir(), `${sanitizeResearchStorageId(searchId)}.json`);
  }

  /**
   * Persist immutable search. Identical hash re-seal OK; different content refused.
   */
  async persistSearch(
    record: MifAnalogueSearchRecord,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const sp = this.searchPath(record.searchId);
    const rp = this.resultsPath(record.searchId);
    try {
      await fs.access(sp);
      const existing = await readJsonFile<MifAnalogueSearchRecord>(sp);
      if (existing && existing.searchHash === record.searchHash) {
        return { ok: true };
      }
      return {
        ok: false,
        code: "SEARCH_EXISTS",
        message: `refusing overwrite of immutable search ${record.searchId}`,
      };
    } catch {
      /* create */
    }

    const meta = {
      ...record,
      analogues: undefined,
      suppressedAnalogues: undefined,
      analogueCount: record.analogues.length,
      suppressedCount: record.suppressedAnalogues.length,
    };
    const results = {
      searchId: record.searchId,
      searchHash: record.searchHash,
      analogues: record.analogues,
      suppressedAnalogues: record.suppressedAnalogues,
    };
    await atomicWrite(rp, `${JSON.stringify(results, null, 2)}\n`);
    await atomicWrite(sp, `${JSON.stringify(meta, null, 2)}\n`);

    // Read-after-write
    const check = await this.getSearch(record.searchId);
    if (!check || check.searchHash !== record.searchHash) {
      return { ok: false, code: "READBACK_FAILED", message: "search read-after-write failed" };
    }
    return { ok: true };
  }

  async getSearch(searchId: string): Promise<MifAnalogueSearchRecord | null> {
    const meta = await readJsonFile<MifAnalogueSearchRecord & { analogueCount?: number }>(
      this.searchPath(searchId),
    );
    if (!meta) return null;
    const results = await readJsonFile<{
      analogues: MifAnalogueSearchRecord["analogues"];
      suppressedAnalogues: MifAnalogueSearchRecord["suppressedAnalogues"];
    }>(this.resultsPath(searchId));
    return {
      ...meta,
      analogues: results?.analogues ?? [],
      suppressedAnalogues: results?.suppressedAnalogues ?? [],
    };
  }

  async listSearches(opts?: { offset?: number; limit?: number }): Promise<{
    searches: Array<{ searchId: string; searchHash: string; createdAt: string; status: string }>;
    total: number;
  }> {
    await this.ensureLayout();
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.searchesDir())).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    names.sort();
    const offset = Math.max(0, opts?.offset ?? 0);
    const limit = Math.max(1, opts?.limit ?? 50);
    const slice = names.slice(offset, offset + limit);
    const searches = [];
    for (const n of slice) {
      const doc = await readJsonFile<MifAnalogueSearchRecord>(path.join(this.searchesDir(), n));
      if (doc) {
        searches.push({
          searchId: doc.searchId,
          searchHash: doc.searchHash,
          createdAt: doc.createdAt,
          status: doc.status,
        });
      }
    }
    return { searches, total: names.length };
  }
}

let singleton: MifAnalogueSearchStorage | null = null;

export function getMifAnalogueSearchStorage(storageRoot?: string): MifAnalogueSearchStorage {
  if (storageRoot) return new MifAnalogueSearchStorage(storageRoot);
  if (!singleton) singleton = new MifAnalogueSearchStorage();
  return singleton;
}

export function __setMifAnalogueSearchStorageForTests(
  store: MifAnalogueSearchStorage | null,
): void {
  singleton = store;
}
