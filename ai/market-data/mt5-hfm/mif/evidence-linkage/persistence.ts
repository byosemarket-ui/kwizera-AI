import { promises as fs } from "node:fs";
import path from "node:path";
import { MIF_EVIDENCE_LINKAGE_MAX_LIST } from "./contracts.js";
import type { MifEvidenceLinkageRecord } from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveEvidenceLinkageRoot(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "mif", "evidence-linkages");
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

export class MifEvidenceLinkageStorage {
  readonly root: string;
  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveEvidenceLinkageRoot(storageRoot);
  }
  async ensureLayout(): Promise<void> {
    await ensureDir(this.root);
  }
  pathFor(id: string): string {
    return path.join(this.root, `${sanitizeId(id)}.json`);
  }
  async persist(
    linkage: MifEvidenceLinkageRecord,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const p = this.pathFor(linkage.linkageId);
    const existing = await readJsonFile<MifEvidenceLinkageRecord>(p);
    if (existing) {
      if (existing.linkageHash === linkage.linkageHash) return { ok: true, created: false };
      return {
        ok: false,
        code: "LINKAGE_CONFLICT",
        message: `conflicting linkage ${linkage.linkageId}`,
      };
    }
    await atomicWrite(p, `${JSON.stringify(linkage, null, 2)}\n`);
    return { ok: true, created: true };
  }
  async get(linkageId: string): Promise<MifEvidenceLinkageRecord | null> {
    return readJsonFile(this.pathFor(linkageId));
  }
  async list(filter?: {
    predictionId?: string;
    searchId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MifEvidenceLinkageRecord[]; total: number }> {
    await this.ensureLayout();
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.root)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifEvidenceLinkageRecord[] = [];
    for (const n of names) {
      const rec = await readJsonFile<MifEvidenceLinkageRecord>(path.join(this.root, n));
      if (!rec) continue;
      if (filter?.predictionId && rec.predictionId !== filter.predictionId) continue;
      if (filter?.searchId && rec.searchId !== filter.searchId) continue;
      items.push(rec);
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = items.length;
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.min(
      MIF_EVIDENCE_LINKAGE_MAX_LIST,
      Math.max(1, filter?.limit ?? 50),
    );
    return { items: items.slice(offset, offset + limit), total };
  }
}

let _store: MifEvidenceLinkageStorage | null = null;
export function getMifEvidenceLinkageStorage(storageRoot?: string): MifEvidenceLinkageStorage {
  if (storageRoot) return new MifEvidenceLinkageStorage(storageRoot);
  if (!_store) _store = new MifEvidenceLinkageStorage();
  return _store;
}
export function __setMifEvidenceLinkageStorageForTests(
  store: MifEvidenceLinkageStorage | null,
): void {
  _store = store;
}
