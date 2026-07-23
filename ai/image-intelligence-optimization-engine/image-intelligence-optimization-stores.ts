import fs from "node:fs";
import path from "node:path";
import {
  ImageCacheOptimization,
  ImageIntelligenceOptimizationRecord,
  ImageIntelligenceRecoveryPoint,
} from "./types.js";

export class ImageIntelligenceOptimizationRecordStore {
  private storePath = "";
  private recoveryPath = "";
  private cachePath = "";
  private records = new Map<string, ImageIntelligenceOptimizationRecord>();
  private recoveryPoints = new Map<string, ImageIntelligenceRecoveryPoint>();
  private activeCache: ImageCacheOptimization = {
    images: [],
    brands: [],
    products: [],
    backgrounds: [],
    creativeStyles: [],
    templates: [],
    campaigns: [],
    productionPlans: [],
    hitRate: 0,
  };

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "optimization-records.json");
    this.recoveryPath = path.join(engineDir, "recovery-points.json");
    this.cachePath = path.join(engineDir, "optimization-cache.json");

    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ImageIntelligenceOptimizationRecord[];
      for (const record of list) {
        this.records.set(record.optimizationId, record);
      }
    }
    if (fs.existsSync(this.recoveryPath)) {
      const list = JSON.parse(fs.readFileSync(this.recoveryPath, "utf8")) as ImageIntelligenceRecoveryPoint[];
      for (const point of list) {
        this.recoveryPoints.set(point.recoveryId, point);
      }
    }
    if (fs.existsSync(this.cachePath)) {
      this.activeCache = JSON.parse(fs.readFileSync(this.cachePath, "utf8")) as ImageCacheOptimization;
    }
  }

  upsert(record: ImageIntelligenceOptimizationRecord): void {
    this.records.set(record.optimizationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  saveRecoveryPoint(point: ImageIntelligenceRecoveryPoint): void {
    this.recoveryPoints.set(point.recoveryId, point);
    fs.writeFileSync(this.recoveryPath, JSON.stringify([...this.recoveryPoints.values()], null, 2), "utf8");
  }

  getRecoveryPoint(recoveryId: string): ImageIntelligenceRecoveryPoint | undefined {
    return this.recoveryPoints.get(recoveryId);
  }

  updateCache(cache: ImageCacheOptimization): void {
    this.activeCache = cache;
    fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf8");
  }

  getCache(): ImageCacheOptimization {
    return this.activeCache;
  }

  restoreCache(snapshot: ImageCacheOptimization): void {
    this.updateCache(snapshot);
  }

  get(optimizationId: string): ImageIntelligenceOptimizationRecord | undefined {
    return this.records.get(optimizationId);
  }

  getByImage(imageId: string): ImageIntelligenceOptimizationRecord[] {
    return this.getAll().filter((r) => r.imageId === imageId);
  }

  getAll(): ImageIntelligenceOptimizationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
