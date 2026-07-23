import fs from "node:fs";
import path from "node:path";
import { PREPARED_IMAGE_INTELLIGENCE_MODULES } from "./image-intelligence-categories.js";
export class ImageIntelligenceIntegrityVerifier {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    verify(storage, registry) {
        const issues = [];
        let checkedPaths = 0;
        const intelligenceRoot = storage.getIntelligenceRoot();
        if (!fs.existsSync(intelligenceRoot)) {
            issues.push(`Image intelligence root missing: ${intelligenceRoot}`);
        }
        else {
            checkedPaths++;
        }
        for (const module of PREPARED_IMAGE_INTELLIGENCE_MODULES) {
            const modulePath = storage.getModulePath(module.subdirectory);
            checkedPaths++;
            if (!fs.existsSync(modulePath)) {
                issues.push(`Module directory missing: ${modulePath}`);
            }
        }
        const registryPath = storage.getRegistryPath();
        checkedPaths++;
        if (!fs.existsSync(registryPath)) {
            issues.push(`Registry file missing: ${registryPath}`);
        }
        const checksumVerified = registry.verifyChecksum();
        if (!checksumVerified && fs.existsSync(registryPath)) {
            issues.push("Registry checksum verification failed");
        }
        const manifestPath = path.join(intelligenceRoot, "foundation-manifest.json");
        if (!fs.existsSync(manifestPath)) {
            issues.push("Foundation manifest missing — will be created on next persist");
        }
        else {
            checkedPaths++;
        }
        const verified = issues.length === 0;
        this.logger.log(verified ? "info" : "warn", "integrity", "Image intelligence integrity verification complete", {
            verified,
            checkedPaths,
            issues: issues.length,
        });
        return {
            verified,
            checkedPaths,
            issues,
            checksumVerified,
            timestamp: new Date().toISOString(),
        };
    }
    writeManifest(storage, storageRoot) {
        const manifest = {
            foundationVersion: "0.1.0",
            storageRoot,
            intelligenceRoot: storage.getIntelligenceRoot(),
            modules: PREPARED_IMAGE_INTELLIGENCE_MODULES.map((m) => m.moduleId),
            createdAt: new Date().toISOString(),
        };
        const manifestPath = path.join(storage.getIntelligenceRoot(), "foundation-manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    }
}
//# sourceMappingURL=image-intelligence-integrity-verifier.js.map