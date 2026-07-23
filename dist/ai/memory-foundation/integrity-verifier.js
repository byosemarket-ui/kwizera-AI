import fs from "node:fs";
import path from "node:path";
import { PREPARED_MEMORY_CATEGORIES } from "./memory-categories.js";
export class IntegrityVerifier {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    verify(storage, registry) {
        const issues = [];
        let checkedPaths = 0;
        const memoryRoot = storage.getMemoryRoot();
        if (!fs.existsSync(memoryRoot)) {
            issues.push(`Memory root missing: ${memoryRoot}`);
        }
        else {
            checkedPaths++;
        }
        for (const category of PREPARED_MEMORY_CATEGORIES) {
            const categoryPath = storage.getCategoryPath(category.subdirectory);
            checkedPaths++;
            if (!fs.existsSync(categoryPath)) {
                issues.push(`Category directory missing: ${categoryPath}`);
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
        const manifestPath = path.join(memoryRoot, "foundation-manifest.json");
        if (!fs.existsSync(manifestPath)) {
            issues.push("Foundation manifest missing — will be created on next persist");
        }
        else {
            checkedPaths++;
        }
        const verified = issues.length === 0;
        this.logger.log(verified ? "info" : "warn", "integrity", "Memory integrity verification complete", {
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
            memoryRoot: storage.getMemoryRoot(),
            categories: PREPARED_MEMORY_CATEGORIES.map((c) => c.memoryId),
            createdAt: new Date().toISOString(),
        };
        const manifestPath = path.join(storage.getMemoryRoot(), "foundation-manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    }
}
//# sourceMappingURL=integrity-verifier.js.map