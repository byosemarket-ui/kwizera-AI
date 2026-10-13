/**
 * Bounded persistence for OpenAI snapshot analyses (Phase 43E).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import type { LocalSnapshotEvidencePackage } from "../snapshot-local/types.js";
import {
  OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
  type OpenAiSnapshotAnalysisResult,
} from "./types.js";

const MAX_ANALYSES = 100;

interface StoreFile {
  version: 1;
  schemaVersion: string;
  analyses: Array<{
    analysis: OpenAiSnapshotAnalysisResult;
    evidence: LocalSnapshotEvidencePackage | null;
  }>;
}

const EMPTY: StoreFile = {
  version: 1,
  schemaVersion: OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
  analyses: [],
};

export class OpenAiSnapshotAnalysisStore {
  private readonly rootDir: string;
  private readonly storePath: string;
  private ready = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot?: string) {
    this.rootDir = path.join(storageRoot ?? resolveStorageRoot(), "forex-openai-snapshot-analyses");
    this.storePath = path.join(this.rootDir, "store.json");
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    fs.mkdirSync(this.rootDir, { recursive: true });
    if (!fs.existsSync(this.storePath)) {
      await writeJsonAtomic(this.storePath, EMPTY);
    }
    this.ready = true;
  }

  private readFile(): StoreFile {
    const result = readJsonSafeSync<StoreFile>(this.storePath, EMPTY);
    const value = result.value ?? EMPTY;
    return {
      version: 1,
      schemaVersion: OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
      analyses: Array.isArray(value.analyses) ? value.analyses : [],
    };
  }

  async save(
    analysis: OpenAiSnapshotAnalysisResult,
    evidence: LocalSnapshotEvidencePackage | null,
  ): Promise<void> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const store = this.readFile();
      store.analyses.push({ analysis, evidence });
      if (store.analyses.length > MAX_ANALYSES) {
        store.analyses = store.analyses.slice(-MAX_ANALYSES);
      }
      await writeJsonAtomic(this.storePath, store);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
  }

  async get(analysisId: string): Promise<{
    analysis: OpenAiSnapshotAnalysisResult;
    evidence: LocalSnapshotEvidencePackage | null;
  } | null> {
    await this.ensureReady();
    const id = String(analysisId ?? "").trim();
    if (!id) return null;
    return this.readFile().analyses.find((a) => a.analysis.analysisId === id) ?? null;
  }

  async listBySnapshot(snapshotId: string, limit = 10): Promise<OpenAiSnapshotAnalysisResult[]> {
    await this.ensureReady();
    const id = String(snapshotId ?? "").trim();
    return this.readFile().analyses
      .map((a) => a.analysis)
      .filter((a) => a.snapshotId === id)
      .slice(-Math.max(1, Math.min(50, limit)))
      .reverse();
  }
}

let storeSingleton: OpenAiSnapshotAnalysisStore | null = null;

export function getOpenAiSnapshotAnalysisStore(): OpenAiSnapshotAnalysisStore {
  storeSingleton ??= new OpenAiSnapshotAnalysisStore();
  return storeSingleton;
}

export function resetOpenAiSnapshotAnalysisStoreForTests(): void {
  storeSingleton = null;
}
