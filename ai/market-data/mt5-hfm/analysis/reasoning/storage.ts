/**
 * Persist Phase 3 reasoning results under mt5-hfm/analysis/reasoning/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveHfmAnalysisDir } from "../storage.js";
import { HFM_REASONING_RETENTION_DAYS } from "./constants.js";
import type { HfmReasoningRecord } from "./types.js";

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, filePath);
}

export class HfmReasoningStorage {
  readonly root: string;

  constructor(storageRoot?: string) {
    this.root = path.join(resolveHfmAnalysisDir(storageRoot), "reasoning");
  }

  async ensureReady(): Promise<void> {
    await ensureDir(this.root);
  }

  recordPath(analysisId: string): string {
    return path.join(this.root, `${analysisId}.json`);
  }

  async save(record: HfmReasoningRecord): Promise<void> {
    await this.ensureReady();
    await atomicWrite(this.recordPath(record.analysisId), `${JSON.stringify(record, null, 2)}\n`);
  }

  async load(analysisId: string): Promise<HfmReasoningRecord | null> {
    try {
      const raw = await fs.readFile(this.recordPath(analysisId), "utf8");
      return JSON.parse(raw) as HfmReasoningRecord;
    } catch {
      return null;
    }
  }

  async list(opts?: {
    symbol?: string;
    contextId?: string;
    limit?: number;
    offset?: number;
  }): Promise<HfmReasoningRecord[]> {
    await this.ensureReady();
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.root)).filter((n) => n.endsWith(".json"));
    } catch {
      return [];
    }
    const records: HfmReasoningRecord[] = [];
    for (const name of names) {
      const rec = await this.load(name.slice(0, -5));
      if (!rec) continue;
      if (opts?.symbol && rec.symbol.toUpperCase() !== opts.symbol.toUpperCase()) continue;
      if (opts?.contextId && rec.contextId !== opts.contextId) continue;
      records.push(rec);
    }
    records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const offset = Math.max(0, opts?.offset ?? 0);
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 20));
    return records.slice(offset, offset + limit);
  }

  async cleanupExpired(nowMs = Date.now()): Promise<{ deleted: number }> {
    await this.ensureReady();
    let deleted = 0;
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.root)).filter((n) => n.endsWith(".json"));
    } catch {
      return { deleted: 0 };
    }
    for (const name of names) {
      const rec = await this.load(name.slice(0, -5));
      if (!rec) continue;
      const t = Date.parse(rec.createdAt);
      if (!Number.isFinite(t)) continue;
      const ageDays = (nowMs - t) / 86400_000;
      if (ageDays < HFM_REASONING_RETENTION_DAYS) continue;
      if (rec.status === "WAITING_FOR_OPENAI" || rec.status === "REASONING" || rec.status === "VALIDATING_RESPONSE") {
        continue;
      }
      await fs.unlink(this.recordPath(rec.analysisId)).catch(() => undefined);
      deleted += 1;
    }
    return { deleted };
  }
}

let singleton: HfmReasoningStorage | null = null;

export function getHfmReasoningStorage(): HfmReasoningStorage {
  if (!singleton) singleton = new HfmReasoningStorage();
  return singleton;
}

export function __setHfmReasoningStorageForTests(store: HfmReasoningStorage | null): void {
  singleton = store;
}
