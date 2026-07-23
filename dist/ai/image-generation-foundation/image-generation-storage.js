import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_IMAGE_GENERATION_MODULES } from "./image-generation-categories.js";
export class ImageGenerationStorageManager {
    logger;
    generationRoot = "";
    registryDir = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storageRoot) {
        this.generationRoot = resolveStoragePath(storageRoot, "imageGeneration");
        this.registryDir = path.join(this.generationRoot, "registry");
        const dirs = [
            this.generationRoot,
            this.registryDir,
            path.join(this.generationRoot, "quality"),
            path.join(this.generationRoot, "history"),
            path.join(this.generationRoot, "blueprints"),
            path.join(this.generationRoot, "assets"),
            path.join(this.generationRoot, "projects"),
            path.join(this.generationRoot, "workflow"),
            path.join(this.generationRoot, "batch"),
            path.join(this.generationRoot, "distributed"),
            path.join(this.generationRoot, "cloud"),
            ...PREPARED_IMAGE_GENERATION_MODULES.map((m) => path.join(this.generationRoot, m.subdirectory)),
        ];
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.logger.log("info", "startup", "Image Generation storage directories ensured", {
            generationRoot: this.generationRoot,
            moduleCount: PREPARED_IMAGE_GENERATION_MODULES.length,
        });
        return this.generationRoot;
    }
    getGenerationRoot() {
        return this.generationRoot;
    }
    getRegistryPath() {
        return path.join(this.registryDir, "image-generation-registry.json");
    }
    getModulePath(subdirectory) {
        return path.join(this.generationRoot, subdirectory);
    }
    getQualityPath() {
        return path.join(this.generationRoot, "quality");
    }
    getAssetsPath() {
        return path.join(this.generationRoot, "assets");
    }
    getProjectsPath() {
        return path.join(this.generationRoot, "projects");
    }
    getBlueprintsPath() {
        return path.join(this.generationRoot, "blueprints");
    }
    getWorkflowPath() {
        return path.join(this.generationRoot, "workflow");
    }
    verifyPersistence() {
        const required = [
            this.generationRoot,
            this.registryDir,
            path.join(this.generationRoot, "assets"),
            path.join(this.generationRoot, "projects"),
            path.join(this.generationRoot, "blueprints"),
            path.join(this.generationRoot, "workflow"),
            ...PREPARED_IMAGE_GENERATION_MODULES.map((m) => path.join(this.generationRoot, m.subdirectory)),
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
                ? `All ${verified} image generation paths persist on disk`
                : `${verified}/${required.length} paths verified`,
        };
    }
}
//# sourceMappingURL=image-generation-storage.js.map