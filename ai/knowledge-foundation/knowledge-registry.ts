import fs from "node:fs";
import crypto from "node:crypto";
import {
  KnowledgeHealthLevel,
  KnowledgeModuleRegistration,
  KnowledgeModuleStatus,
  KnowledgeRegistrySnapshot,
} from "./types.js";
import { DEFAULT_MODULE_STATUS, PREPARED_KNOWLEDGE_CATEGORIES } from "./knowledge-categories.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";

const FOUNDATION_VERSION = "0.1.0";

export class KnowledgeRegistry {
  private modules = new Map<string, KnowledgeModuleRegistration>();
  private storage: KnowledgeStorageManager | null = null;
  private storageRoot = "";

  constructor(private readonly logger: KnowledgeFoundationLogger) {}

  initialize(storage: KnowledgeStorageManager, storageRoot: string): void {
    this.storage = storage;
    this.storageRoot = storageRoot;
    const registryPath = storage.getRegistryPath();

    if (fs.existsSync(registryPath)) {
      this.loadFromDisk(registryPath);
      this.logger.log("info", "startup", "Knowledge registry loaded from disk", {
        modules: this.modules.size,
      });
    } else {
      this.seedPreparedCategories(storage);
      this.persist();
      this.logger.log("info", "startup", "Knowledge registry created with prepared categories", {
        modules: this.modules.size,
      });
    }
  }

  private seedPreparedCategories(storage: KnowledgeStorageManager): void {
    const now = new Date().toISOString();
    for (const prepared of PREPARED_KNOWLEDGE_CATEGORIES) {
      const registration: KnowledgeModuleRegistration = {
        knowledgeId: prepared.knowledgeId,
        knowledgeName: prepared.knowledgeName,
        version: "0.0.0",
        status: DEFAULT_MODULE_STATUS,
        dependencies: prepared.dependencies,
        source: prepared.defaultSource,
        qualityScore: 0,
        confidenceScore: 0,
        storageLocation: storage.getCategoryPath(prepared.subdirectory),
        healthStatus: KnowledgeHealthLevel.Good,
        lastUpdate: now,
        accessPermissions: prepared.accessPermissions,
        category: prepared.category,
        implemented: false,
      };
      this.modules.set(prepared.knowledgeId, registration);
    }
  }

  private loadFromDisk(registryPath: string): void {
    const raw = fs.readFileSync(registryPath, "utf8");
    const snapshot = JSON.parse(raw) as KnowledgeRegistrySnapshot;
    this.modules.clear();

    for (const mod of snapshot.modules) {
      this.modules.set(mod.knowledgeId, mod);
    }

    for (const prepared of PREPARED_KNOWLEDGE_CATEGORIES) {
      if (!this.modules.has(prepared.knowledgeId)) {
        const now = new Date().toISOString();
        this.modules.set(prepared.knowledgeId, {
          knowledgeId: prepared.knowledgeId,
          knowledgeName: prepared.knowledgeName,
          version: "0.0.0",
          status: DEFAULT_MODULE_STATUS,
          dependencies: prepared.dependencies,
          source: prepared.defaultSource,
          qualityScore: 0,
          confidenceScore: 0,
          storageLocation: this.storage!.getCategoryPath(prepared.subdirectory),
          healthStatus: KnowledgeHealthLevel.Good,
          lastUpdate: now,
          accessPermissions: prepared.accessPermissions,
          category: prepared.category,
          implemented: false,
        });
      }
    }
  }

  registerModule(registration: Omit<KnowledgeModuleRegistration, "lastUpdate" | "healthStatus"> & {
    healthStatus?: KnowledgeHealthLevel;
    lastUpdate?: string;
  }): void {
    if (!this.modules.has(registration.knowledgeId)) {
      throw new Error(`Unknown knowledge category: ${registration.knowledgeId}`);
    }

    const existing = this.modules.get(registration.knowledgeId)!;
    const updated: KnowledgeModuleRegistration = {
      ...existing,
      ...registration,
      status: KnowledgeModuleStatus.Registered,
      lastUpdate: new Date().toISOString(),
      healthStatus: registration.healthStatus ?? existing.healthStatus,
    };
    this.modules.set(registration.knowledgeId, updated);
    this.persist();
    this.logger.log("info", "registration", `Knowledge module registered: ${registration.knowledgeId}`, {
      version: registration.version,
      source: registration.source,
      qualityScore: registration.qualityScore,
    });
  }

  getModule(knowledgeId: string): KnowledgeModuleRegistration | undefined {
    return this.modules.get(knowledgeId);
  }

  getAllModules(): KnowledgeModuleRegistration[] {
    return [...this.modules.values()];
  }

  getPreparedCount(): number {
    return this.modules.size;
  }

  getRegisteredCount(): number {
    return [...this.modules.values()].filter(
      (m) => m.status === KnowledgeModuleStatus.Registered || m.status === KnowledgeModuleStatus.Active
    ).length;
  }

  getSnapshot(storageRoot: string): KnowledgeRegistrySnapshot {
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

  updateHealth(knowledgeId: string, level: KnowledgeHealthLevel): void {
    const mod = this.modules.get(knowledgeId);
    if (!mod) return;
    mod.healthStatus = level;
    mod.lastUpdate = new Date().toISOString();
    this.modules.set(knowledgeId, mod);
  }

  updateQualityScores(knowledgeId: string, qualityScore: number, confidenceScore: number): void {
    const mod = this.modules.get(knowledgeId);
    if (!mod) return;
    mod.qualityScore = qualityScore;
    mod.confidenceScore = confidenceScore;
    mod.lastUpdate = new Date().toISOString();
    this.modules.set(knowledgeId, mod);
  }
}
