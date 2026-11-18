/**
 * Protected HFM Analysis context + image storage under KWIZERA_STORAGE_ROOT.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HfmAnalysisChartImageMeta, HfmAnalysisContextResult } from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveHfmAnalysisDir(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "analysis");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, data: Buffer | string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, filePath);
}

export class HfmAnalysisStorage {
  readonly root: string;
  readonly contextsDir: string;
  readonly imagesDir: string;
  readonly metadataDir: string;
  readonly diagnosticsDir: string;
  readonly retentionDir: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveHfmAnalysisDir(storageRoot);
    this.contextsDir = path.join(this.root, "contexts");
    this.imagesDir = path.join(this.root, "images");
    this.metadataDir = path.join(this.root, "metadata");
    this.diagnosticsDir = path.join(this.root, "diagnostics");
    this.retentionDir = path.join(this.root, "retention");
  }

  async ensureReady(): Promise<void> {
    await ensureDir(this.contextsDir);
    await ensureDir(this.imagesDir);
    await ensureDir(this.metadataDir);
    await ensureDir(this.diagnosticsDir);
    await ensureDir(this.retentionDir);
  }

  contextPath(snapshotId: string): string {
    return path.join(this.contextsDir, `${snapshotId}.json`);
  }

  imagePath(imageId: string): string {
    return path.join(this.imagesDir, `${imageId}.png`);
  }

  imageMetaPath(imageId: string): string {
    return path.join(this.metadataDir, `${imageId}.json`);
  }

  async saveContext(result: HfmAnalysisContextResult): Promise<void> {
    await this.ensureReady();
    if (!result.snapshot) return;
    const id = result.snapshot.snapshotId;
    // Strip PNG bytes — only persist serializable result.
    await atomicWrite(this.contextPath(id), `${JSON.stringify(result, null, 2)}\n`);
  }

  async saveImage(meta: HfmAnalysisChartImageMeta, png: Buffer): Promise<void> {
    await this.ensureReady();
    await atomicWrite(this.imagePath(meta.imageId), png);
    await atomicWrite(this.imageMetaPath(meta.imageId), `${JSON.stringify(meta, null, 2)}\n`);
  }

  async loadContext(snapshotId: string): Promise<HfmAnalysisContextResult | null> {
    try {
      const raw = await fs.readFile(this.contextPath(snapshotId), "utf8");
      return JSON.parse(raw) as HfmAnalysisContextResult;
    } catch {
      return null;
    }
  }

  async loadImage(imageId: string): Promise<{ meta: HfmAnalysisChartImageMeta; png: Buffer } | null> {
    try {
      const metaRaw = await fs.readFile(this.imageMetaPath(imageId), "utf8");
      const meta = JSON.parse(metaRaw) as HfmAnalysisChartImageMeta;
      const png = await fs.readFile(this.imagePath(imageId));
      return { meta, png };
    } catch {
      return null;
    }
  }

  /** Public API helper — never returns filesystem path. */
  protectedImageRef(imageId: string): { imageId: string; retrievalPath: string } {
    return {
      imageId,
      retrievalPath: `/api/forex/providers/mt5-hfm/analysis/images/${encodeURIComponent(imageId)}`,
    };
  }
}

let singleton: HfmAnalysisStorage | null = null;

export function getHfmAnalysisStorage(): HfmAnalysisStorage {
  if (!singleton) singleton = new HfmAnalysisStorage();
  return singleton;
}

export function __setHfmAnalysisStorageForTests(store: HfmAnalysisStorage | null): void {
  singleton = store;
}
