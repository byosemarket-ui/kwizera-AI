import fs from "node:fs";
import crypto from "node:crypto";
import { MemoryHealthLevel, MemoryModuleStatus, } from "./types.js";
import { DEFAULT_MODULE_STATUS, PREPARED_MEMORY_CATEGORIES } from "./memory-categories.js";
const FOUNDATION_VERSION = "0.1.0";
export class MemoryRegistry {
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
            this.loadFromDisk(registryPath, storageRoot);
            this.logger.log("info", "startup", "Memory registry loaded from disk", {
                modules: this.modules.size,
            });
        }
        else {
            this.seedPreparedCategories(storage, storageRoot);
            this.persist();
            this.logger.log("info", "startup", "Memory registry created with prepared categories", {
                modules: this.modules.size,
            });
        }
    }
    seedPreparedCategories(storage, storageRoot) {
        const now = new Date().toISOString();
        for (const prepared of PREPARED_MEMORY_CATEGORIES) {
            const registration = {
                memoryId: prepared.memoryId,
                memoryName: prepared.memoryName,
                version: "0.0.0",
                status: DEFAULT_MODULE_STATUS,
                dependencies: prepared.dependencies,
                storageLocation: storage.getCategoryPath(prepared.subdirectory),
                healthStatus: MemoryHealthLevel.Good,
                lastUpdate: now,
                accessPermissions: prepared.accessPermissions,
                category: prepared.category,
                implemented: false,
            };
            this.modules.set(prepared.memoryId, registration);
        }
        void storageRoot;
    }
    loadFromDisk(registryPath, storageRoot) {
        const raw = fs.readFileSync(registryPath, "utf8");
        const snapshot = JSON.parse(raw);
        this.modules.clear();
        for (const mod of snapshot.modules) {
            this.modules.set(mod.memoryId, mod);
        }
        for (const prepared of PREPARED_MEMORY_CATEGORIES) {
            if (!this.modules.has(prepared.memoryId)) {
                const now = new Date().toISOString();
                this.modules.set(prepared.memoryId, {
                    memoryId: prepared.memoryId,
                    memoryName: prepared.memoryName,
                    version: "0.0.0",
                    status: DEFAULT_MODULE_STATUS,
                    dependencies: prepared.dependencies,
                    storageLocation: this.storage.getCategoryPath(prepared.subdirectory),
                    healthStatus: MemoryHealthLevel.Good,
                    lastUpdate: now,
                    accessPermissions: prepared.accessPermissions,
                    category: prepared.category,
                    implemented: false,
                });
            }
        }
        void storageRoot;
    }
    registerModule(registration) {
        if (!this.modules.has(registration.memoryId)) {
            throw new Error(`Unknown memory category: ${registration.memoryId}`);
        }
        const existing = this.modules.get(registration.memoryId);
        const updated = {
            ...existing,
            ...registration,
            status: MemoryModuleStatus.Registered,
            lastUpdate: new Date().toISOString(),
        };
        this.modules.set(registration.memoryId, updated);
        this.persist();
        this.logger.log("info", "registration", `Memory module registered: ${registration.memoryId}`, {
            version: registration.version,
            status: updated.status,
        });
    }
    getModule(memoryId) {
        return this.modules.get(memoryId);
    }
    getAllModules() {
        return [...this.modules.values()];
    }
    getPreparedCount() {
        return this.modules.size;
    }
    getRegisteredCount() {
        return [...this.modules.values()].filter((m) => m.status === MemoryModuleStatus.Registered || m.status === MemoryModuleStatus.Active).length;
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
    updateHealth(memoryId, level) {
        const mod = this.modules.get(memoryId);
        if (!mod)
            return;
        mod.healthStatus = level;
        mod.lastUpdate = new Date().toISOString();
        this.modules.set(memoryId, mod);
    }
}
//# sourceMappingURL=memory-registry.js.map