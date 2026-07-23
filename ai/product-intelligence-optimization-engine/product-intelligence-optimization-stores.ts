import fs from "node:fs";
import path from "node:path";
import { CacheOptimization, ProductIntelligenceOptimizationRecord, ProductIntelligenceRecoveryPoint } from "./types.js";

export class ProductIntelligenceOptimizationRecordStore {
  private storePath = "";
  private recoveryPath = "";
  private cachePath = "";
  private records = new Map<string, ProductIntelligenceOptimizationRecord>();
  private recoveryPoints = new Map<string, ProductIntelligenceRecoveryPoint>();
  private activeCache: CacheOptimization = {
    products: [],
    brands: [],
    creativeStyles: [],
    campaignTypes: [],
    audienceProfiles: [],
    storyboards: [],
    visualPlans: [],
    audioPlans: [],
    hitRate: 0,
  };

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "optimization-records.json");
    this.recoveryPath = path.join(engineDir, "recovery-points.json");
    this.cachePath = path.join(engineDir, "optimization-cache.json");

    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ProductIntelligenceOptimizationRecord[];
      for (const record of list) {
        this.records.set(record.optimizationId, record);
      }
    }
    if (fs.existsSync(this.recoveryPath)) {
      const list = JSON.parse(fs.readFileSync(this.recoveryPath, "utf8")) as ProductIntelligenceRecoveryPoint[];
      for (const point of list) {
        this.recoveryPoints.set(point.recoveryId, point);
      }
    }
    if (fs.existsSync(this.cachePath)) {
      this.activeCache = JSON.parse(fs.readFileSync(this.cachePath, "utf8")) as CacheOptimization;
    }
  }

  upsert(record: ProductIntelligenceOptimizationRecord): void {
    this.records.set(record.optimizationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  saveRecoveryPoint(point: ProductIntelligenceRecoveryPoint): void {
    this.recoveryPoints.set(point.recoveryId, point);
    fs.writeFileSync(this.recoveryPath, JSON.stringify([...this.recoveryPoints.values()], null, 2), "utf8");
  }

  getRecoveryPoint(recoveryId: string): ProductIntelligenceRecoveryPoint | undefined {
    return this.recoveryPoints.get(recoveryId);
  }

  updateCache(cache: CacheOptimization): void {
    this.activeCache = cache;
    fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf8");
  }

  getCache(): CacheOptimization {
    return this.activeCache;
  }

  restoreCache(snapshot: CacheOptimization): void {
    this.updateCache(snapshot);
  }

  get(optimizationId: string): ProductIntelligenceOptimizationRecord | undefined {
    return this.records.get(optimizationId);
  }

  getByProduct(productId: string): ProductIntelligenceOptimizationRecord[] {
    return this.getAll().filter((r) => r.productId === productId);
  }

  getAll(): ProductIntelligenceOptimizationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
