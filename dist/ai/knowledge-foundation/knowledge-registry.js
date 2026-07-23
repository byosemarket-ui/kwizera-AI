import fs from "node:fs";
import crypto from "node:crypto";
import { KnowledgeHealthLevel, KnowledgeModuleStatus, } from "./types.js";
import { DEFAULT_MODULE_STATUS, PREPARED_KNOWLEDGE_CATEGORIES } from "./knowledge-categories.js";
const FOUNDATION_VERSION = "0.1.0";
export class KnowledgeRegistry {
    logger;
    modules = new Map();
    storage = null;
    storageRoot = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage, storageRoot) {
        this.storage = storage;
        this.storageRoot = storageRoot;
        const registryPath = storage.getRegistryPath();
        if (fs.existsSync(registryPath)) {
            this.loadFromDisk(registryPath);
            this.logger.log("info", "startup", "Knowledge registry loaded from disk", {
                modules: this.modules.size,
            });
        }
        else {
            this.seedPreparedCategories(storage);
            this.persist();
            this.logger.log("info", "startup", "Knowledge registry created with prepared categories", {
                modules: this.modules.size,
            });
        }
    }
    seedPreparedCategories(storage) {
        const now = new Date().toISOString();
        for (const prepared of PREPARED_KNOWLEDGE_CATEGORIES) {
            const registration = {
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
    loadFromDisk(registryPath) {
        const raw = fs.readFileSync(registryPath, "utf8");
        const snapshot = JSON.parse(raw);
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
                    storageLocation: this.storage.getCategoryPath(prepared.subdirectory),
                    healthStatus: KnowledgeHealthLevel.Good,
                    lastUpdate: now,
                    accessPermissions: prepared.accessPermissions,
                    category: prepared.category,
                    implemented: false,
                });
            }
        }
    }
    registerModule(registration) {
        if (!this.modules.has(registration.knowledgeId)) {
            throw new Error(`Unknown knowledge category: ${registration.knowledgeId}`);
        }
        const existing = this.modules.get(registration.knowledgeId);
        const updated = {
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
    getModule(knowledgeId) {
        return this.modules.get(knowledgeId);
    }
    getAllModules() {
        return [...this.modules.values()];
    }
    getPreparedCount() {
        return this.modules.size;
    }
    getRegisteredCount() {
        return [...this.modules.values()].filter((m) => m.status === KnowledgeModuleStatus.Registered || m.status === KnowledgeModuleStatus.Active).length;
    }
    getSnapshot(storageRoot) {
        return {
            foundationVersion: FOUNDATION_VERSION,
            storageRoot,
            lastUpdated: new Date().toISOString(),
            modules: this.getAllModules(),
        };
    }
    persist() {
        if (!this.storage)
            return;
        const registryPath = this.storage.getRegistryPath();
        const snapshot = this.getSnapshot(this.storageRoot);
        fs.writeFileSync(registryPath, JSON.stringify(snapshot, null, 2), "utf8");
        this.writeChecksum(registryPath);
    }
    writeChecksum(registryPath) {
        const content = fs.readFileSync(registryPath, "utf8");
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        fs.writeFileSync(`${registryPath}.sha256`, hash, "utf8");
    }
    verifyChecksum() {
        if (!this.storage)
            return false;
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
    updateHealth(knowledgeId, level) {
        const mod = this.modules.get(knowledgeId);
        if (!mod)
            return;
        mod.healthStatus = level;
        mod.lastUpdate = new Date().toISOString();
        this.modules.set(knowledgeId, mod);
    }
    updateQualityScores(knowledgeId, qualityScore, confidenceScore) {
        const mod = this.modules.get(knowledgeId);
        if (!mod)
            return;
        mod.qualityScore = qualityScore;
        mod.confidenceScore = confidenceScore;
        mod.lastUpdate = new Date().toISOString();
        this.modules.set(knowledgeId, mod);
    }
}
//# sourceMappingURL=knowledge-registry.js.map