import fs from "node:fs";
import crypto from "node:crypto";
import {
  ProductIntelligenceHealthLevel,
  ProductIntelligenceModuleRegistration,
  ProductIntelligenceModuleStatus,
  ProductIntelligenceRegistrySnapshot,
} from "./types.js";
import {
  DEFAULT_MODULE_STATUS,
  PREPARED_PRODUCT_INTELLIGENCE_MODULES,
} from "./product-intelligence-categories.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceStorageManager } from "./product-intelligence-storage.js";

const FOUNDATION_VERSION = "0.1.0";

export class ProductIntelligenceRegistry {
  private modules = new Map<string, ProductIntelligenceModuleRegistration>();
  private storage: ProductIntelligenceStorageManager | null = null;
  private storageRoot = "";

  constructor(private readonly logger: ProductIntelligenceFoundationLogger) {}

  initialize(storage: ProductIntelligenceStorageManager, storageRoot: string): void {
    this.storage = storage;
    this.storageRoot = storageRoot;
    const registryPath = storage.getRegistryPath();

    if (fs.existsSync(registryPath)) {
      this.loadFromDisk(registryPath);
      this.logger.log("info", "startup", "Product Intelligence registry loaded from disk", {
        modules: this.modules.size,
      });
    } else {
      this.seedPreparedModules(storage);
      this.persist();
      this.logger.log("info", "startup", "Product Intelligence registry created with prepared modules", {
        modules: this.modules.size,
      });
    }
  }

  private seedPreparedModules(storage: ProductIntelligenceStorageManager): void {
    const now = new Date().toISOString();
    for (const prepared of PREPARED_PRODUCT_INTELLIGENCE_MODULES) {
      const registration: ProductIntelligenceModuleRegistration = {
        moduleId: prepared.moduleId,
        moduleName: prepared.moduleName,
        version: "0.0.0",
        status: DEFAULT_MODULE_STATUS,
        dependencies: prepared.dependencies,
        qualityScore: 0,
        confidenceScore: 0,
        storageLocation: storage.getModulePath(prepared.subdirectory),
        healthStatus: ProductIntelligenceHealthLevel.Good,
        createdAt: now,
        lastUpdated: now,
        accessPermissions: prepared.accessPermissions,
        category: prepared.category,
        implemented: false,
      };
      this.modules.set(prepared.moduleId, registration);
    }
  }

  private loadFromDisk(registryPath: string): void {
    const raw = fs.readFileSync(registryPath, "utf8");
    const snapshot = JSON.parse(raw) as ProductIntelligenceRegistrySnapshot;
    this.modules.clear();

    for (const mod of snapshot.modules) {
      this.modules.set(mod.moduleId, mod);
    }

    for (const prepared of PREPARED_PRODUCT_INTELLIGENCE_MODULES) {
      if (!this.modules.has(prepared.moduleId)) {
        const now = new Date().toISOString();
        this.modules.set(prepared.moduleId, {
          moduleId: prepared.moduleId,
          moduleName: prepared.moduleName,
          version: "0.0.0",
          status: DEFAULT_MODULE_STATUS,
          dependencies: prepared.dependencies,
          qualityScore: 0,
          confidenceScore: 0,
          storageLocation: this.storage!.getModulePath(prepared.subdirectory),
          healthStatus: ProductIntelligenceHealthLevel.Good,
          createdAt: now,
          lastUpdated: now,
          accessPermissions: prepared.accessPermissions,
          category: prepared.category,
          implemented: false,
        });
      }
    }
  }

  registerModule(
    registration: Omit<ProductIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
      healthStatus?: ProductIntelligenceHealthLevel;
      lastUpdated?: string;
      createdAt?: string;
    }
  ): void {
    if (!this.modules.has(registration.moduleId)) {
      throw new Error(`Unknown product intelligence module: ${registration.moduleId}`);
    }

    const existing = this.modules.get(registration.moduleId)!;
    const updated: ProductIntelligenceModuleRegistration = {
      ...existing,
      ...registration,
      status: registration.status ?? ProductIntelligenceModuleStatus.Registered,
      createdAt: registration.createdAt ?? existing.createdAt,
      lastUpdated: new Date().toISOString(),
      healthStatus: registration.healthStatus ?? existing.healthStatus,
    };
    this.modules.set(registration.moduleId, updated);
    this.persist();
    this.logger.log("info", "registration", `Product Intelligence module registered: ${registration.moduleId}`, {
      version: registration.version,
      qualityScore: registration.qualityScore,
      confidenceScore: registration.confidenceScore,
    });
  }

  getModule(moduleId: string): ProductIntelligenceModuleRegistration | undefined {
    return this.modules.get(moduleId);
  }

  getAllModules(): ProductIntelligenceModuleRegistration[] {
    return [...this.modules.values()];
  }

  getPreparedCount(): number {
    return this.modules.size;
  }

  getRegisteredCount(): number {
    return [...this.modules.values()].filter(
      (m) =>
        m.status === ProductIntelligenceModuleStatus.Registered ||
        m.status === ProductIntelligenceModuleStatus.Active
    ).length;
  }

  getSnapshot(storageRoot: string): ProductIntelligenceRegistrySnapshot {
    return {
      foundationVersion: FOUNDATION_VERSION,
      storageRoot,
      lastUpdated: new Date().toISOString(),
      modules: this.getAllModules(),
    };
  }

  persist(): void {
    if (!this.storage) return;
    const registryPath = this.storage.getRegistryPath();
    const snapshot = this.getSnapshot(this.storageRoot);
    fs.writeFileSync(registryPath, JSON.stringify(snapshot, null, 2), "utf8");
    this.writeChecksum(registryPath);
  }

  private writeChecksum(registryPath: string): void {
    const content = fs.readFileSync(registryPath, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    fs.writeFileSync(`${registryPath}.sha256`, hash, "utf8");
  }

  verifyChecksum(): boolean {
    if (!this.storage) return false;
    const registryPath = this.storage.getRegistryPath();
    const checksumPath = `${registryPath}.sha256`;
    if (!fs.existsSync(registryPath) || !fs.existsSync(checksumPath)) {
      return false;
    }
    const content = fs.readFileSync(registryPath, "utf8");
    const expected = fs.readFileSync(checksumPath, "utf8").trim();
    const actual = crypto.createHash("sha256").update(content).digest("hex");
    return expected === actual;
  }

  updateHealth(moduleId: string, level: ProductIntelligenceHealthLevel): void {
    const mod = this.modules.get(moduleId);
    if (!mod) return;
    mod.healthStatus = level;
    mod.lastUpdated = new Date().toISOString();
    this.modules.set(moduleId, mod);
  }

  updateQualityScores(moduleId: string, qualityScore: number, confidenceScore: number): void {
    const mod = this.modules.get(moduleId);
    if (!mod) return;
    mod.qualityScore = qualityScore;
    mod.confidenceScore = confidenceScore;
    mod.lastUpdated = new Date().toISOString();
    this.modules.set(moduleId, mod);
  }
}
