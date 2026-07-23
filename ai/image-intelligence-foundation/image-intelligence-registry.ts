import fs from "node:fs";
import crypto from "node:crypto";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceModuleRegistration,
  ImageIntelligenceModuleStatus,
  ImageIntelligenceRegistrySnapshot,
} from "./types.js";
import {
  DEFAULT_MODULE_STATUS,
  PREPARED_IMAGE_INTELLIGENCE_MODULES,
} from "./image-intelligence-categories.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";

const FOUNDATION_VERSION = "0.1.0";

export class ImageIntelligenceRegistry {
  private modules = new Map<string, ImageIntelligenceModuleRegistration>();
  private storage: ImageIntelligenceStorageManager | null = null;
  private storageRoot = "";

  constructor(private readonly logger: ImageIntelligenceFoundationLogger) {}

  initialize(storage: ImageIntelligenceStorageManager, storageRoot: string): void {
    this.storage = storage;
    this.storageRoot = storageRoot;
    const registryPath = storage.getRegistryPath();

    if (fs.existsSync(registryPath)) {
      this.loadFromDisk(registryPath);
      this.logger.log("info", "startup", "Image Intelligence registry loaded from disk", {
        modules: this.modules.size,
      });
    } else {
      this.seedPreparedModules(storage);
      this.persist();
      this.logger.log("info", "startup", "Image Intelligence registry created with prepared modules", {
        modules: this.modules.size,
      });
    }
  }

  private seedPreparedModules(storage: ImageIntelligenceStorageManager): void {
    const now = new Date().toISOString();
    for (const prepared of PREPARED_IMAGE_INTELLIGENCE_MODULES) {
      const registration: ImageIntelligenceModuleRegistration = {
        moduleId: prepared.moduleId,
        moduleName: prepared.moduleName,
        version: "0.0.0",
        status: DEFAULT_MODULE_STATUS,
        dependencies: prepared.dependencies,
        qualityScore: 0,
        confidenceScore: 0,
        storageLocation: storage.getModulePath(prepared.subdirectory),
        healthStatus: ImageIntelligenceHealthLevel.Good,
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
    const snapshot = JSON.parse(raw) as ImageIntelligenceRegistrySnapshot;
    this.modules.clear();

    for (const mod of snapshot.modules) {
      this.modules.set(mod.moduleId, mod);
    }

    for (const prepared of PREPARED_IMAGE_INTELLIGENCE_MODULES) {
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
          healthStatus: ImageIntelligenceHealthLevel.Good,
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
    registration: Omit<ImageIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
      healthStatus?: ImageIntelligenceHealthLevel;
      lastUpdated?: string;
      createdAt?: string;
    }
  ): void {
    if (!this.modules.has(registration.moduleId)) {
      throw new Error(`Unknown image intelligence module: ${registration.moduleId}`);
    }

    const existing = this.modules.get(registration.moduleId)!;
    const updated: ImageIntelligenceModuleRegistration = {
      ...existing,
      ...registration,
      status: registration.status ?? ImageIntelligenceModuleStatus.Registered,
      createdAt: registration.createdAt ?? existing.createdAt,
      lastUpdated: new Date().toISOString(),
      healthStatus: registration.healthStatus ?? existing.healthStatus,
    };
    this.modules.set(registration.moduleId, updated);
    this.persist();
    this.logger.log("info", "registration", `Image Intelligence module registered: ${registration.moduleId}`, {
      version: registration.version,
      qualityScore: registration.qualityScore,
      confidenceScore: registration.confidenceScore,
    });
  }

  getModule(moduleId: string): ImageIntelligenceModuleRegistration | undefined {
    return this.modules.get(moduleId);
  }

  getAllModules(): ImageIntelligenceModuleRegistration[] {
    return [...this.modules.values()];
  }

  getPreparedCount(): number {
    return this.modules.size;
  }

  getRegisteredCount(): number {
    return [...this.modules.values()].filter(
      (m) =>
        m.status === ImageIntelligenceModuleStatus.Registered ||
        m.status === ImageIntelligenceModuleStatus.Active
    ).length;
  }

  getSnapshot(storageRoot: string): ImageIntelligenceRegistrySnapshot {
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

  updateHealth(moduleId: string, level: ImageIntelligenceHealthLevel): void {
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
