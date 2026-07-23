import fs from "node:fs";
import crypto from "node:crypto";
import {
  ImageGenerationHealthLevel,
  ImageGenerationModuleRegistration,
  ImageGenerationModuleStatus,
  ImageGenerationRegistrySnapshot,
} from "./types.js";
import {
  DEFAULT_MODULE_STATUS,
  PREPARED_IMAGE_GENERATION_MODULES,
} from "./image-generation-categories.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";

const FOUNDATION_VERSION = "0.1.0";

export class ImageGenerationRegistry {
  private modules = new Map<string, ImageGenerationModuleRegistration>();
  private storage: ImageGenerationStorageManager | null = null;
  private storageRoot = "";

  constructor(private readonly logger: ImageGenerationFoundationLogger) {}

  initialize(storage: ImageGenerationStorageManager, storageRoot: string): void {
    this.storage = storage;
    this.storageRoot = storageRoot;
    const registryPath = storage.getRegistryPath();

    if (fs.existsSync(registryPath)) {
      this.loadFromDisk(registryPath);
      this.logger.log("info", "startup", "Image Generation registry loaded from disk", {
        modules: this.modules.size,
      });
    } else {
      this.seedPreparedModules(storage);
      this.persist();
      this.logger.log("info", "startup", "Image Generation registry created with prepared modules", {
        modules: this.modules.size,
      });
    }
  }

  private seedPreparedModules(storage: ImageGenerationStorageManager): void {
    const now = new Date().toISOString();
    for (const prepared of PREPARED_IMAGE_GENERATION_MODULES) {
      this.modules.set(prepared.moduleId, {
        moduleId: prepared.moduleId,
        moduleName: prepared.moduleName,
        version: "0.0.0",
        status: DEFAULT_MODULE_STATUS,
        dependencies: prepared.dependencies,
        qualityScore: 0,
        confidenceScore: 0,
        storageLocation: storage.getModulePath(prepared.subdirectory),
        healthStatus: ImageGenerationHealthLevel.Good,
        createdAt: now,
        lastUpdated: now,
        accessPermissions: prepared.accessPermissions,
        category: prepared.category,
        implemented: false,
      });
    }
  }

  private loadFromDisk(registryPath: string): void {
    const snapshot = JSON.parse(fs.readFileSync(registryPath, "utf8")) as ImageGenerationRegistrySnapshot;
    this.modules.clear();
    for (const mod of snapshot.modules) {
      this.modules.set(mod.moduleId, mod);
    }
    for (const prepared of PREPARED_IMAGE_GENERATION_MODULES) {
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
          healthStatus: ImageGenerationHealthLevel.Good,
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
    registration: Omit<ImageGenerationModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
      healthStatus?: ImageGenerationHealthLevel;
      lastUpdated?: string;
      createdAt?: string;
    }
  ): void {
    if (!this.modules.has(registration.moduleId)) {
      throw new Error(`Unknown image generation module: ${registration.moduleId}`);
    }
    const existing = this.modules.get(registration.moduleId)!;
    const updated: ImageGenerationModuleRegistration = {
      ...existing,
      ...registration,
      status: registration.status ?? ImageGenerationModuleStatus.Registered,
      createdAt: registration.createdAt ?? existing.createdAt,
      lastUpdated: new Date().toISOString(),
      healthStatus: registration.healthStatus ?? existing.healthStatus,
    };
    this.modules.set(registration.moduleId, updated);
    this.persist();
    this.logger.log("info", "registration", `Image Generation module registered: ${registration.moduleId}`, {
      version: registration.version,
      qualityScore: registration.qualityScore,
      confidenceScore: registration.confidenceScore,
    });
  }

  getModule(moduleId: string): ImageGenerationModuleRegistration | undefined {
    return this.modules.get(moduleId);
  }

  getAllModules(): ImageGenerationModuleRegistration[] {
    return [...this.modules.values()];
  }

  getPreparedCount(): number {
    return this.modules.size;
  }

  getRegisteredCount(): number {
    return [...this.modules.values()].filter(
      (m) =>
        m.status === ImageGenerationModuleStatus.Registered ||
        m.status === ImageGenerationModuleStatus.Active
    ).length;
  }

  getSnapshot(storageRoot: string): ImageGenerationRegistrySnapshot {
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
    if (!fs.existsSync(registryPath) || !fs.existsSync(checksumPath)) return false;
    const content = fs.readFileSync(registryPath, "utf8");
    const expected = fs.readFileSync(checksumPath, "utf8").trim();
    return expected === crypto.createHash("sha256").update(content).digest("hex");
  }

  updateHealth(moduleId: string, level: ImageGenerationHealthLevel): void {
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
