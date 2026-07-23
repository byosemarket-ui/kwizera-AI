import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_KNOWLEDGE_CATEGORIES } from "./knowledge-categories.js";
export class KnowledgeStorageManager {
    logger;
    knowledgeRoot = "";
    registryDir = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storageRoot) {
        this.knowledgeRoot = resolveStoragePath(storageRoot, "knowledge");
        this.registryDir = path.join(this.knowledgeRoot, "registry");
        const dirs = [
            this.knowledgeRoot,
            this.registryDir,
            path.join(this.knowledgeRoot, "quality"),
            path.join(this.knowledgeRoot, "history"),
            path.join(this.knowledgeRoot, "sources"),
            ...PREPARED_KNOWLEDGE_CATEGORIES.map((c) => path.join(this.knowledgeRoot, c.subdirectory)),
        ];
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.logger.log("info", "startup", "Knowledge storage directories ensured", {
            knowledgeRoot: this.knowledgeRoot,
            categoryCount: PREPARED_KNOWLEDGE_CATEGORIES.length,
        });
        return this.knowledgeRoot;
    }
    getKnowledgeRoot() {
        return this.knowledgeRoot;
    }
    getRegistryPath() {
        return path.join(this.registryDir, "knowledge-registry.json");
    }
    getCategoryPath(subdirectory) {
        return path.join(this.knowledgeRoot, subdirectory);
    }
    getQualityPath() {
        return path.join(this.knowledgeRoot, "quality");
    }
    verifyPersistence() {
        const required = [
            this.knowledgeRoot,
            this.registryDir,
            ...PREPARED_KNOWLEDGE_CATEGORIES.map((c) => path.join(this.knowledgeRoot, c.subdirectory)),
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
                ? `All ${verified} knowledge paths persist on disk`
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
//# sourceMappingURL=knowledge-storage.js.map