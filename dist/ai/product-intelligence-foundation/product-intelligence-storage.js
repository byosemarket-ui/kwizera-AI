import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_PRODUCT_INTELLIGENCE_MODULES } from "./product-intelligence-categories.js";
export class ProductIntelligenceStorageManager {
    logger;
    intelligenceRoot = "";
    registryDir = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storageRoot) {
        this.intelligenceRoot = resolveStoragePath(storageRoot, "productIntelligence");
        this.registryDir = path.join(this.intelligenceRoot, "registry");
        const dirs = [
            this.intelligenceRoot,
            this.registryDir,
            path.join(this.intelligenceRoot, "quality"),
            path.join(this.intelligenceRoot, "history"),
            path.join(this.intelligenceRoot, "plans"),
            ...PREPARED_PRODUCT_INTELLIGENCE_MODULES.map((m) => path.join(this.intelligenceRoot, m.subdirectory)),
        ];
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.logger.log("info", "startup", "Product Intelligence storage directories ensured", {
            intelligenceRoot: this.intelligenceRoot,
            moduleCount: PREPARED_PRODUCT_INTELLIGENCE_MODULES.length,
        });
        return this.intelligenceRoot;
    }
    getIntelligenceRoot() {
        return this.intelligenceRoot;
    }
    getRegistryPath() {
        return path.join(this.registryDir, "product-intelligence-registry.json");
    }
    getModulePath(subdirectory) {
        return path.join(this.intelligenceRoot, subdirectory);
    }
    getQualityPath() {
        return path.join(this.intelligenceRoot, "quality");
    }
    verifyPersistence() {
        const required = [
            this.intelligenceRoot,
            this.registryDir,
            ...PREPARED_PRODUCT_INTELLIGENCE_MODULES.map((m) => path.join(this.intelligenceRoot, m.subdirectory)),
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
                ? `All ${verified} product intelligence paths persist on disk`
                : `${verified}/${required.length} paths verified`,
        };
    }
}
//# sourceMappingURL=product-intelligence-storage.js.map