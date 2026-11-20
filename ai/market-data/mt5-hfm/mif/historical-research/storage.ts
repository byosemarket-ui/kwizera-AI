/**
 * Phase 5F STEP 1 — durable research storage under data/mt5-hfm/research/.
 * Never uses /run tmpfs. Atomic writes. Immutable dataset versions.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  MifResearchDatasetManifest,
  MifResearchExportJob,
  MifResearchPitMetadataBundle,
  MifResearchRegistryEntry,
  MifResearchStoredBar,
} from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveResearchRoot(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "research");
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
      /* target may not exist */
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

export class MifHistoricalResearchStorage {
  readonly root: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveResearchRoot(storageRoot);
  }

  barsDir(): string {
    return path.join(this.root, "bars");
  }
  datasetsDir(): string {
    return path.join(this.root, "datasets");
  }
  manifestsDir(): string {
    return path.join(this.root, "manifests");
  }
  metadataDir(): string {
    return path.join(this.root, "metadata");
  }
  exportJobsDir(): string {
    return path.join(this.root, "export-jobs");
  }
  registryPath(): string {
    return path.join(this.root, "registry.json");
  }

  datasetVersionDir(datasetId: string, version: number): string {
    return path.join(this.datasetsDir(), sanitizeId(datasetId), `v${version}`);
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.barsDir());
    await ensureDir(this.datasetsDir());
    await ensureDir(this.manifestsDir());
    await ensureDir(this.metadataDir());
    await ensureDir(this.exportJobsDir());
  }

  async persistExportJob(job: MifResearchExportJob): Promise<void> {
    await this.ensureLayout();
    const p = path.join(this.exportJobsDir(), `${sanitizeId(job.jobId)}.json`);
    await atomicWrite(p, `${JSON.stringify(job, null, 2)}\n`);
  }

  async getExportJob(jobId: string): Promise<MifResearchExportJob | null> {
    return readJsonFile<MifResearchExportJob>(
      path.join(this.exportJobsDir(), `${sanitizeId(jobId)}.json`),
    );
  }

  async persistJobBars(jobId: string, bars: readonly MifResearchStoredBar[]): Promise<string> {
    await this.ensureLayout();
    const rel = path.join("bars", `job-${sanitizeId(jobId)}.json`);
    const abs = path.join(this.root, rel);
    await atomicWrite(abs, `${JSON.stringify({ bars }, null, 2)}\n`);
    return rel.replace(/\\/g, "/");
  }

  async loadJobBars(jobId: string): Promise<MifResearchStoredBar[]> {
    const abs = path.join(this.barsDir(), `job-${sanitizeId(jobId)}.json`);
    const doc = await readJsonFile<{ bars: MifResearchStoredBar[] }>(abs);
    return doc?.bars ?? [];
  }

  async persistPitMetadata(
    refId: string,
    bundle: MifResearchPitMetadataBundle,
  ): Promise<string> {
    await this.ensureLayout();
    const rel = path.join("metadata", `${sanitizeId(refId)}.json`);
    await atomicWrite(path.join(this.root, rel), `${JSON.stringify(bundle, null, 2)}\n`);
    return rel.replace(/\\/g, "/");
  }

  /**
   * Seal an immutable dataset version. Refuses overwrite if version already exists.
   */
  async persistImmutableDataset(input: {
    manifest: MifResearchDatasetManifest;
    bars: readonly MifResearchStoredBar[];
  }): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const dir = this.datasetVersionDir(input.manifest.datasetId, input.manifest.version);
    const manifestPath = path.join(dir, "manifest.json");
    const barsPath = path.join(dir, "bars.json");

    try {
      await fs.access(manifestPath);
      const existing = await readJsonFile<MifResearchDatasetManifest>(manifestPath);
      if (existing && existing.contentHash === input.manifest.contentHash) {
        // Idempotent re-seal of identical content — not an overwrite of different data.
        return { ok: true };
      }
      return {
        ok: false,
        code: "DATASET_VERSION_EXISTS",
        message: `refusing overwrite of immutable dataset ${input.manifest.datasetId} v${input.manifest.version}`,
      };
    } catch {
      /* does not exist — ok */
    }

    await ensureDir(dir);
    await atomicWrite(barsPath, `${JSON.stringify({ bars: input.bars }, null, 2)}\n`);
    await atomicWrite(manifestPath, `${JSON.stringify(input.manifest, null, 2)}\n`);

    // Mirror manifest for flat lookup
    const flat = path.join(
      this.manifestsDir(),
      `${sanitizeId(input.manifest.datasetId)}.v${input.manifest.version}.json`,
    );
    await atomicWrite(flat, `${JSON.stringify(input.manifest, null, 2)}\n`);

    await this.upsertRegistry({
      datasetId: input.manifest.datasetId,
      version: input.manifest.version,
      instrument: input.manifest.instrument,
      timeframe: input.manifest.timeframe,
      status: input.manifest.status,
      contentHash: input.manifest.contentHash,
      candleCount: input.manifest.candleCount,
      startTime: input.manifest.startTime,
      endTime: input.manifest.endTime,
      createdAt: input.manifest.createdAt,
      manifestRelativePath: path
        .relative(this.root, manifestPath)
        .replace(/\\/g, "/"),
    });

    return { ok: true };
  }

  async getDatasetManifest(
    datasetId: string,
    version?: number,
  ): Promise<MifResearchDatasetManifest | null> {
    if (version != null) {
      return readJsonFile<MifResearchDatasetManifest>(
        path.join(this.datasetVersionDir(datasetId, version), "manifest.json"),
      );
    }
    const entries = await this.listRegistry();
    const matches = entries
      .filter((e) => e.datasetId === datasetId)
      .sort((a, b) => b.version - a.version);
    if (!matches.length) return null;
    return this.getDatasetManifest(datasetId, matches[0]!.version);
  }

  async getDatasetBars(
    datasetId: string,
    version: number,
    opts?: { offset?: number; limit?: number },
  ): Promise<{ bars: MifResearchStoredBar[]; total: number } | null> {
    const doc = await readJsonFile<{ bars: MifResearchStoredBar[] }>(
      path.join(this.datasetVersionDir(datasetId, version), "bars.json"),
    );
    if (!doc) return null;
    const offset = Math.max(0, opts?.offset ?? 0);
    const limit = Math.max(1, opts?.limit ?? doc.bars.length);
    return {
      bars: doc.bars.slice(offset, offset + limit),
      total: doc.bars.length,
    };
  }

  async listRegistry(): Promise<MifResearchRegistryEntry[]> {
    const doc = await readJsonFile<{ entries: MifResearchRegistryEntry[] }>(
      this.registryPath(),
    );
    return doc?.entries ?? [];
  }

  private async upsertRegistry(entry: MifResearchRegistryEntry): Promise<void> {
    const entries = await this.listRegistry();
    const idx = entries.findIndex(
      (e) => e.datasetId === entry.datasetId && e.version === entry.version,
    );
    if (idx >= 0) {
      // Idempotent only when content hash matches; never mutate a different immutable version.
      if (entries[idx]!.contentHash === entry.contentHash) return;
      throw new Error(
        `registry already contains ${entry.datasetId} v${entry.version} with different contentHash`,
      );
    }
    entries.push(entry);
    entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    await atomicWrite(
      this.registryPath(),
      `${JSON.stringify({ entries }, null, 2)}\n`,
    );
  }
}

/** Sanitize ids for cross-platform durable paths (Windows forbids ':'). */
export function sanitizeResearchStorageId(id: string): string {
  return String(id || "")
    .replace(/:/g, "_")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 180);
}

function sanitizeId(id: string): string {
  return sanitizeResearchStorageId(id);
}

let singleton: MifHistoricalResearchStorage | null = null;

export function getMifHistoricalResearchStorage(
  storageRoot?: string,
): MifHistoricalResearchStorage {
  if (storageRoot) return new MifHistoricalResearchStorage(storageRoot);
  if (!singleton) singleton = new MifHistoricalResearchStorage();
  return singleton;
}

export function __setMifHistoricalResearchStorageForTests(
  store: MifHistoricalResearchStorage | null,
): void {
  singleton = store;
}
