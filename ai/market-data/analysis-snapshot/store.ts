/**
 * Bounded filesystem persistence for analysis market snapshots (Phase 43B).
 * Pattern mirrors forex-monitor / forex-memory JSON stores.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import {
  ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  type AnalysisMarketSnapshot,
} from "./types.js";

const MAX_SNAPSHOTS = 200;

interface AnalysisSnapshotStoreFile {
  version: 1;
  schemaVersion: string;
  snapshots: AnalysisMarketSnapshot[];
}

const EMPTY: AnalysisSnapshotStoreFile = {
  version: 1,
  schemaVersion: ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  snapshots: [],
};

export class AnalysisSnapshotStore {
  private readonly rootDir: string;
  private readonly storePath: string;
  private ready = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot?: string) {
    this.rootDir = path.join(storageRoot ?? resolveStorageRoot(), "forex-analysis-snapshots");
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

  private readFile(): AnalysisSnapshotStoreFile {
    const result = readJsonSafeSync<AnalysisSnapshotStoreFile>(this.storePath, EMPTY);
    const value = result.value ?? EMPTY;
    return {
      version: 1,
      schemaVersion: ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
      snapshots: Array.isArray(value.snapshots) ? value.snapshots : [],
    };
  }

  async save(snapshot: AnalysisMarketSnapshot): Promise<void> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const store = this.readFile();
      store.snapshots.push(snapshot);
      if (store.snapshots.length > MAX_SNAPSHOTS) {
        store.snapshots = store.snapshots.slice(-MAX_SNAPSHOTS);
      }
      await writeJsonAtomic(this.storePath, store);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
  }

  async get(snapshotId: string): Promise<AnalysisMarketSnapshot | null> {
    await this.ensureReady();
    const id = String(snapshotId ?? "").trim();
    if (!id) return null;
    const store = this.readFile();
    return store.snapshots.find((s) => s.snapshotId === id) ?? null;
  }

  async listMeta(limit = 20): Promise<Array<{
    snapshotId: string;
    createdAt: string;
    provider: string;
    symbol: string;
    candleTimeframe: string;
    analysisPeriod: string;
    validationStatus: string;
    evidenceReady: boolean;
    contentFingerprint: string;
  }>> {
    await this.ensureReady();
    const store = this.readFile();
    return store.snapshots
      .slice(-Math.max(1, Math.min(100, limit)))
      .reverse()
      .map((s) => ({
        snapshotId: s.snapshotId,
        createdAt: s.createdAt,
        provider: s.provider,
        symbol: s.instrument.displaySymbol,
        candleTimeframe: s.candleTimeframe,
        analysisPeriod: s.analysisPeriod,
        validationStatus: s.validation.status,
        evidenceReady: s.evidenceReady,
        contentFingerprint: s.contentFingerprint,
      }));
  }
}

let storeSingleton: AnalysisSnapshotStore | null = null;

export function getAnalysisSnapshotStore(): AnalysisSnapshotStore {
  storeSingleton ??= new AnalysisSnapshotStore();
  return storeSingleton;
}

export function resetAnalysisSnapshotStoreForTests(): void {
  storeSingleton = null;
}
