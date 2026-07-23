import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_MEMORY_CATEGORIES, PROTECTED_DATA_CATEGORIES } from "./memory-categories.js";
export class MemoryStorageManager {
    logger;
    memoryRoot = "";
    registryDir = "";
    backupsDir = "";
    protectedDir = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storageRoot) {
        this.memoryRoot = resolveStoragePath(storageRoot, "memory");
        this.registryDir = path.join(this.memoryRoot, "registry");
        this.backupsDir = path.join(this.memoryRoot, "backups");
        this.protectedDir = path.join(this.memoryRoot, "protected");
        const dirs = [
            this.memoryRoot,
            this.registryDir,
            this.backupsDir,
            this.protectedDir,
            ...PREPARED_MEMORY_CATEGORIES.map((c) => path.join(this.memoryRoot, c.subdirectory)),
            ...PROTECTED_DATA_CATEGORIES.map((c) => path.join(this.protectedDir, c)),
        ];
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.logger.log("info", "startup", "Memory storage directories ensured", {
            memoryRoot: this.memoryRoot,
            categoryCount: PREPARED_MEMORY_CATEGORIES.length,
            protectedCount: PROTECTED_DATA_CATEGORIES.length,
        });
        return this.memoryRoot;
    }
    getMemoryRoot() {
        return this.memoryRoot;
    }
    getRegistryPath() {
        return path.join(this.registryDir, "memory-registry.json");
    }
    getCategoryPath(subdirectory) {
        return path.join(this.memoryRoot, subdirectory);
    }
    getBackupsDir() {
        return this.backupsDir;
    }
    getProtectedDir() {
        return this.protectedDir;
    }
    verifyPersistence() {
        const required = [
            this.memoryRoot,
            this.registryDir,
            this.backupsDir,
            ...PREPARED_MEMORY_CATEGORIES.map((c) => path.join(this.memoryRoot, c.subdirectory)),
        ];
        let verified = 0;
        for (const p of required) {
            if (fs.existsSync(p))
                verified++;
        }
        const passed = verified === required.length;
        return {
            passed,
            pathsVerified: verified,
            detail: passed
                ? `All ${verified} memory paths persist on disk`
                : `${verified}/${required.length} paths verified`,
        };
    }
    writeCategoryData(subdirectory, filename, data) {
        const start = Date.now();
        const filePath = path.join(this.getCategoryPath(subdirectory), filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
        return Date.now() - start;
    }
    readCategoryData(subdirectory, filename) {
        const start = Date.now();
        const filePath = path.join(this.getCategoryPath(subdirectory), filename);
        if (!fs.existsSync(filePath)) {
            return { data: null, durationMs: Date.now() - start };
        }
        const raw = fs.readFileSync(filePath, "utf8");
        return { data: JSON.parse(raw), durationMs: Date.now() - start };
    }
}
//# sourceMappingURL=memory-storage.js.map