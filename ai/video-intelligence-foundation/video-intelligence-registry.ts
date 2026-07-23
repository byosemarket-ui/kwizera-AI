import fs from "node:fs";
import crypto from "node:crypto";
import {
  VideoIntelligenceHealthLevel,
  VideoIntelligenceModuleRegistration,
  VideoIntelligenceModuleStatus,
  VideoIntelligenceRegistrySnapshot,
} from "./types.js";
import {
  DEFAULT_MODULE_STATUS,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "./video-intelligence-categories.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";

const FOUNDATION_VERSION = "0.1.0";

export class VideoIntelligenceRegistry {
  private modules = new Map<string, VideoIntelligenceModuleRegistration>();
  private storage: VideoIntelligenceStorageManager | null = null;
  private storageRoot = "";

  constructor(private readonly logger: VideoIntelligenceFoundationLogger) {}

  initialize(storage: VideoIntelligenceStorageManager, storageRoot: string): void {
    this.storage = storage;
    this.storageRoot = storageRoot;
    const registryPath = storage.getRegistryPath();

    if (fs.existsSync(registryPath)) {
      this.loadFromDisk(registryPath);
      this.logger.log("info", "startup", "Video Intelligence registry loaded from disk", {
        modules: this.modules.size,
      });
    } else {
      this.seedPreparedModules(storage);
      this.persist();
      this.logger.log("info", "startup", "Video Intelligence registry created with prepared modules", {
        modules: this.modules.size,
      });
    }
  }

  private seedPreparedModules(storage: VideoIntelligenceStorageManager): void {
    const now = new Date().toISOString();
    for (const prepared of PREPARED_VIDEO_INTELLIGENCE_MODULES) {
      const registration: VideoIntelligenceModuleRegistration = {
        moduleId: prepared.moduleId,
        moduleName: prepared.moduleName,
        version: "0.0.0",
        status: DEFAULT_MODULE_STATUS,
        dependencies: prepared.dependencies,
        qualityScore: 0,
        confidenceScore: 0,
        storageLocation: storage.getModulePath(prepared.subdirectory),
        healthStatus: VideoIntelligenceHealthLevel.Good,
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
    const snapshot = JSON.parse(raw) as VideoIntelligenceRegistrySnapshot;
    this.modules.clear();

    for (const mod of snapshot.modules) {
      this.modules.set(mod.moduleId, mod);
    }

    for (const prepared of PREPARED_VIDEO_INTELLIGENCE_MODULES) {
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
          healthStatus: VideoIntelligenceHealthLevel.Good,
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
    registration: Omit<VideoIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
      healthStatus?: VideoIntelligenceHealthLevel;
      lastUpdated?: string;
      createdAt?: string;
    }
  ): void {
    if (!this.modules.has(registration.moduleId)) {
      throw new Error(`Unknown video intelligence module: ${registration.moduleId}`);
    }

    const existing = this.modules.get(registration.moduleId)!;
    const updated: VideoIntelligenceModuleRegistration = {
      ...existing,
      ...registration,
      status: registration.status ?? VideoIntelligenceModuleStatus.Registered,
      createdAt: registration.createdAt ?? existing.createdAt,
      lastUpdated: new Date().toISOString(),
      healthStatus: registration.healthStatus ?? existing.healthStatus,
    };
    this.modules.set(registration.moduleId, updated);
    this.persist();
    this.logger.log("info", "registration", `Video Intelligence module registered: ${registration.moduleId}`, {
      version: registration.version,
      qualityScore: registration.qualityScore,
      confidenceScore: registration.confidenceScore,
    });
  }

  getModule(moduleId: string): VideoIntelligenceModuleRegistration | undefined {
    return this.modules.get(moduleId);
  }

  getAllModules(): VideoIntelligenceModuleRegistration[] {
    return [...this.modules.values()];
  }

  getPreparedCount(): number {
    return this.modules.size;
  }

  getRegisteredCount(): number {
    return [...this.modules.values()].filter(
      (m) =>
        m.status === VideoIntelligenceModuleStatus.Registered ||
        m.status === VideoIntelligenceModuleStatus.Active
    ).length;
  }

  getSnapshot(storageRoot: string): VideoIntelligenceRegistrySnapshot {
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

  updateHealth(moduleId: string, level: VideoIntelligenceHealthLevel): void {
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
