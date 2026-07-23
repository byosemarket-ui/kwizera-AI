import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_VIDEO_INTELLIGENCE_MODULES } from "./video-intelligence-categories.js";
export class VideoIntelligenceStorageManager {
    logger;
    intelligenceRoot = "";
    registryDir = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storageRoot) {
        this.intelligenceRoot = resolveStoragePath(storageRoot, "videoIntelligence");
        this.registryDir = path.join(this.intelligenceRoot, "registry");
        const dirs = [
            this.intelligenceRoot,
            this.registryDir,
            path.join(this.intelligenceRoot, "quality"),
            path.join(this.intelligenceRoot, "history"),
            path.join(this.intelligenceRoot, "plans"),
            path.join(this.intelligenceRoot, "assets"),
            path.join(this.intelligenceRoot, "indexes"),
            path.join(this.intelligenceRoot, "projects"),
            path.join(this.intelligenceRoot, "workflow"),
            path.join(this.intelligenceRoot, "timelines"),
            path.join(this.intelligenceRoot, "scenes"),
            path.join(this.intelligenceRoot, "batch"),
            ...PREPARED_VIDEO_INTELLIGENCE_MODULES.map((m) => path.join(this.intelligenceRoot, m.subdirectory)),
        ];
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.logger.log("info", "startup", "Video Intelligence storage directories ensured", {
            intelligenceRoot: this.intelligenceRoot,
            moduleCount: PREPARED_VIDEO_INTELLIGENCE_MODULES.length,
        });
        return this.intelligenceRoot;
    }
    getIntelligenceRoot() {
        return this.intelligenceRoot;
    }
    getRegistryPath() {
        return path.join(this.registryDir, "video-intelligence-registry.json");
    }
    getModulePath(subdirectory) {
        return path.join(this.intelligenceRoot, subdirectory);
    }
    getQualityPath() {
        return path.join(this.intelligenceRoot, "quality");
    }
    getAssetsPath() {
        return path.join(this.intelligenceRoot, "assets");
    }
    getIndexesPath() {
        return path.join(this.intelligenceRoot, "indexes");
    }
    getProjectsPath() {
        return path.join(this.intelligenceRoot, "projects");
    }
    getWorkflowPath() {
        return path.join(this.intelligenceRoot, "workflow");
    }
    verifyPersistence() {
        const required = [
            this.intelligenceRoot,
            this.registryDir,
            path.join(this.intelligenceRoot, "assets"),
            path.join(this.intelligenceRoot, "indexes"),
            path.join(this.intelligenceRoot, "projects"),
            path.join(this.intelligenceRoot, "workflow"),
            ...PREPARED_VIDEO_INTELLIGENCE_MODULES.map((m) => path.join(this.intelligenceRoot, m.subdirectory)),
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
                ? `All ${verified} video intelligence paths persist on disk`
                : `${verified}/${required.length} paths verified`,
        };
    }
}
//# sourceMappingURL=video-intelligence-storage.js.map