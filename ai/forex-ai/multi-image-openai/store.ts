/**
 * Phase 49B — Persist multi-image analysis audit records (no image byte copies).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import { MULTI_IMAGE_ANALYSIS_SCHEMA, MULTI_IMAGE_MAX_STORED } from "./limits.js";
import type { MultiImageAnalysisResult } from "./types.js";
import type { LocalSnapshotEvidencePackage } from "../snapshot-local/types.js";

interface StoreFile {
  version: 1;
  schemaVersion: string;
  analyses: Array<{
    analysis: MultiImageAnalysisResult;
    evidence: LocalSnapshotEvidencePackage | null;
  }>;
}

const EMPTY: StoreFile = {
  version: 1,
  schemaVersion: MULTI_IMAGE_ANALYSIS_SCHEMA,
  analyses: [],
};

export class MultiImageAnalysisStore {
  private readonly rootDir: string;
  private readonly storePath: string;
  private ready = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot?: string) {
    this.rootDir = path.join(storageRoot ?? resolveStorageRoot(), "forex-openai-multi-image-analyses");
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
      schemaVersion: MULTI_IMAGE_ANALYSIS_SCHEMA,
      analyses: Array.isArray(value.analyses) ? value.analyses : [],
    };
  }

  async save(
    analysis: MultiImageAnalysisResult,
    evidence: LocalSnapshotEvidencePackage | null,
  ): Promise<void> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const store = this.readFile();
      store.analyses.push({ analysis, evidence });
      if (store.analyses.length > MULTI_IMAGE_MAX_STORED) {
        store.analyses = store.analyses.slice(-MULTI_IMAGE_MAX_STORED);
      }
      await writeJsonAtomic(this.storePath, store);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
  }

  async get(analysisId: string): Promise<{
    analysis: MultiImageAnalysisResult;
    evidence: LocalSnapshotEvidencePackage | null;
  } | null> {
    await this.ensureReady();
    const id = String(analysisId ?? "").trim();
    if (!id) return null;
    return this.readFile().analyses.find((a) => a.analysis.analysisId === id) ?? null;
  }

  async listRecent(limit = 10): Promise<MultiImageAnalysisResult[]> {
    await this.ensureReady();
    return this.readFile().analyses
      .map((a) => a.analysis)
      .slice(-Math.max(1, Math.min(50, limit)))
      .reverse();
  }
}

let singleton: MultiImageAnalysisStore | null = null;

export function getMultiImageAnalysisStore(storageRoot?: string): MultiImageAnalysisStore {
  if (storageRoot) return new MultiImageAnalysisStore(storageRoot);
  singleton ??= new MultiImageAnalysisStore();
  return singleton;
}
