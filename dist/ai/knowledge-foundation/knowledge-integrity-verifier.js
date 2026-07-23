import fs from "node:fs";
import path from "node:path";
import { PREPARED_KNOWLEDGE_CATEGORIES } from "./knowledge-categories.js";
export class KnowledgeIntegrityVerifier {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    verify(storage, registry) {
        const issues = [];
        let checkedPaths = 0;
        const knowledgeRoot = storage.getKnowledgeRoot();
        if (!fs.existsSync(knowledgeRoot)) {
            issues.push(`Knowledge root missing: ${knowledgeRoot}`);
        }
        else {
            checkedPaths++;
        }
        for (const category of PREPARED_KNOWLEDGE_CATEGORIES) {
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
        const manifestPath = path.join(knowledgeRoot, "foundation-manifest.json");
        if (!fs.existsSync(manifestPath)) {
            issues.push("Foundation manifest missing — will be created on next persist");
        }
        else {
            checkedPaths++;
        }
        const verified = issues.length === 0;
        this.logger.log(verified ? "info" : "warn", "integrity", "Knowledge integrity verification complete", {
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
            knowledgeRoot: storage.getKnowledgeRoot(),
            categories: PREPARED_KNOWLEDGE_CATEGORIES.map((c) => c.knowledgeId),
            createdAt: new Date().toISOString(),
        };
        const manifestPath = path.join(storage.getKnowledgeRoot(), "foundation-manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    }
}
//# sourceMappingURL=knowledge-integrity-verifier.js.map