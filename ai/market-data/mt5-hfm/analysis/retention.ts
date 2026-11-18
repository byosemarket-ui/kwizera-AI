/**
 * Safe retention cleanup — images 7d, contexts 90d. Never deletes active job images.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  HFM_ANALYSIS_HISTORY_RETENTION_DAYS,
  HFM_ANALYSIS_IMAGE_RETENTION_DAYS,
} from "./constants.js";
import { getActiveAnalysisJob } from "./job-context.js";
import { getHfmAnalysisStorage, type HfmAnalysisStorage } from "./storage.js";
import type { HfmAnalysisChartImageMeta, HfmAnalysisContextResult } from "./types.js";

export interface RetentionCleanupResult {
  ok: boolean;
  imagesDeleted: number;
  contextsDeleted: number;
  skippedActive: number;
  errors: string[];
  ranAt: string;
}

function ageDays(iso: string, now = Date.now()): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return (now - t) / (86400_000);
}

async function listJsonIds(dir: string, ext: string): Promise<string[]> {
  try {
    const names = await fs.readdir(dir);
    return names.filter((n) => n.endsWith(ext)).map((n) => n.slice(0, -ext.length));
  } catch {
    return [];
  }
}

export async function runHfmAnalysisRetentionCleanup(opts?: {
  storage?: HfmAnalysisStorage;
  nowMs?: number;
  activeImageIds?: Set<string>;
}): Promise<RetentionCleanupResult> {
  const storage = opts?.storage ?? getHfmAnalysisStorage();
  await storage.ensureReady();
  const now = opts?.nowMs ?? Date.now();
  const errors: string[] = [];
  let imagesDeleted = 0;
  let contextsDeleted = 0;
  let skippedActive = 0;

  const active = getActiveAnalysisJob();
  const activeIds = opts?.activeImageIds ?? new Set<string>();

  // Protect images referenced by contexts newer than image retention that are still "active"/recent.
  const contextIds = await listJsonIds(storage.contextsDir, ".json");
  for (const id of contextIds) {
    try {
      const ctx = await storage.loadContext(id);
      if (!ctx?.snapshot) continue;
      if (active && ctx.job.jobId === active.jobId) {
        for (const meta of Object.values(ctx.chartImages)) activeIds.add(meta.imageId);
      }
      // Also protect very fresh contexts (< 1 hour)
      if (ageDays(ctx.snapshot.capturedAt, now) < 1 / 24) {
        for (const meta of Object.values(ctx.chartImages)) activeIds.add(meta.imageId);
      }
    } catch (err) {
      errors.push(`context scan ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const imageIds = await listJsonIds(storage.metadataDir, ".json");
  for (const imageId of imageIds) {
    try {
      const loaded = await storage.loadImage(imageId);
      if (!loaded) continue;
      const meta: HfmAnalysisChartImageMeta = loaded.meta;
      if (activeIds.has(imageId)) {
        skippedActive += 1;
        continue;
      }
      if (ageDays(meta.capturedAt, now) < HFM_ANALYSIS_IMAGE_RETENTION_DAYS) continue;
      await fs.unlink(storage.imagePath(imageId)).catch(() => undefined);
      await fs.unlink(storage.imageMetaPath(imageId)).catch(() => undefined);
      imagesDeleted += 1;
    } catch (err) {
      errors.push(`image ${imageId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const id of contextIds) {
    try {
      const ctx = (await storage.loadContext(id)) as HfmAnalysisContextResult | null;
      if (!ctx?.snapshot) continue;
      if (active && ctx.job.jobId === active.jobId) continue;
      if (ageDays(ctx.snapshot.capturedAt, now) < HFM_ANALYSIS_HISTORY_RETENTION_DAYS) continue;
      await fs.unlink(storage.contextPath(id)).catch(() => undefined);
      contextsDeleted += 1;
    } catch (err) {
      errors.push(`context delete ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const result: RetentionCleanupResult = {
    ok: errors.length === 0,
    imagesDeleted,
    contextsDeleted,
    skippedActive,
    errors,
    ranAt: new Date(now).toISOString(),
  };

  try {
    const logPath = path.join(storage.retentionDir, "last-cleanup.json");
    await fs.writeFile(logPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  } catch (err) {
    errors.push(`retention log: ${err instanceof Error ? err.message : String(err)}`);
    result.errors = errors;
    result.ok = false;
  }

  return result;
}
