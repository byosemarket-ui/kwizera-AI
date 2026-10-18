/**
 * Phase 53 — Independent Automated Trading OpenAI analysis history (no secrets).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import type { AtOpenAiAnalysisResult } from "./types.js";

const MAX_HISTORY = 40;

interface StoreFile {
  version: 1;
  latestId: string | null;
  history: AtOpenAiAnalysisResult[];
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "openai-analysis-history.json",
  );
}

function normalize(raw: unknown): StoreFile {
  if (!raw || typeof raw !== "object") {
    return { version: 1, latestId: null, history: [] };
  }
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as AtOpenAiAnalysisResult[]).filter((x) => x && typeof x === "object" && x.analysisId)
    : [];
  return {
    version: 1,
    latestId: typeof o.latestId === "string" ? o.latestId : history[0]?.analysisId ?? null,
    history: history.slice(0, MAX_HISTORY),
  };
}

export class AtOpenAiAnalysisStore {
  private data: StoreFile;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null));
  }

  latest(): AtOpenAiAnalysisResult | null {
    if (!this.data.latestId) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.analysisId === this.data.latestId) ?? this.data.history[0] ?? null;
  }

  get(id: string): AtOpenAiAnalysisResult | null {
    return this.data.history.find((h) => h.analysisId === id) ?? null;
  }

  list(limit = 12): AtOpenAiAnalysisResult[] {
    const n = Math.max(1, Math.min(MAX_HISTORY, Math.floor(limit)));
    return this.data.history.slice(0, n);
  }

  async save(result: AtOpenAiAnalysisResult): Promise<void> {
    const next = [result, ...this.data.history.filter((h) => h.analysisId !== result.analysisId)]
      .slice(0, MAX_HISTORY);
    this.data = { version: 1, latestId: result.analysisId, history: next };
    await writeJsonAtomic(this.file, this.data);
  }

  count(): number {
    return this.data.history.length;
  }
}

let singleton: AtOpenAiAnalysisStore | null = null;

export function getAtOpenAiAnalysisStore(storageRoot?: string): AtOpenAiAnalysisStore {
  if (storageRoot) return new AtOpenAiAnalysisStore(storageRoot);
  if (!singleton) singleton = new AtOpenAiAnalysisStore();
  return singleton;
}

export function resetAtOpenAiAnalysisStoreForTests(): void {
  singleton = null;
}
