import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { BackupSource } from "./types.js";
const SOURCE_PATHS = [
    { source: BackupSource.PersistentMemory, segment: "memory", subpath: "persistent" },
    { source: BackupSource.ProjectMemory, segment: "memory", subpath: "projects" },
    { source: BackupSource.ProductMemory, segment: "memory", subpath: "products" },
    { source: BackupSource.VideoMemory, segment: "memory", subpath: "videos" },
    { source: BackupSource.MarketingMemory, segment: "memory", subpath: "marketing" },
    { source: BackupSource.LearningMemory, segment: "memory", subpath: "learning" },
    { source: BackupSource.KnowledgeMemory, segment: "memory", subpath: "knowledge" },
    { source: BackupSource.RelationshipMemory, segment: "memory", subpath: "relationships" },
    { source: BackupSource.WorkflowHistory, segment: "memory", subpath: "protected/workflows" },
    { source: BackupSource.DecisionHistory, segment: "memory", subpath: "protected/decisions" },
    { source: BackupSource.ReasoningHistory, segment: "memory", subpath: "protected/reasoning" },
    { source: BackupSource.UserPreferences, segment: "memory", subpath: "user-preferences" },
    { source: BackupSource.Configuration, segment: "config" },
    { source: BackupSource.Database, segment: "database" },
    { source: BackupSource.AiSettings, segment: "config", subpath: "ai" },
    { source: BackupSource.ProjectAssets, segment: "projects" },
    { source: BackupSource.GeneratedVideos, segment: "media", subpath: "videos" },
    { source: BackupSource.GeneratedImages, segment: "media", subpath: "images" },
    { source: BackupSource.GeneratedScripts, segment: "exports", subpath: "scripts" },
];
export class BackupSourceScanner {
    storageRoot;
    constructor(storageRoot) {
        this.storageRoot = storageRoot;
    }
    scan(sources) {
        const targetSources = sources ?? SOURCE_PATHS.map((s) => s.source);
        const files = [];
        for (const mapping of SOURCE_PATHS) {
            if (!targetSources.includes(mapping.source))
                continue;
            const basePath = mapping.subpath
                ? path.join(resolveStoragePath(this.storageRoot, mapping.segment), mapping.subpath)
                : resolveStoragePath(this.storageRoot, mapping.segment);
            if (!fs.existsSync(basePath))
                continue;
            this.walkDirectory(basePath, this.storageRoot, mapping.source, files);
        }
        const memoryRoot = resolveStoragePath(this.storageRoot, "memory");
        const coreFiles = ["registry/memory-registry.json", "indexes", "retrieval"];
        for (const rel of coreFiles) {
            const abs = path.join(memoryRoot, rel);
            if (!fs.existsSync(abs))
                continue;
            if (fs.statSync(abs).isDirectory()) {
                this.walkDirectory(abs, this.storageRoot, BackupSource.PersistentMemory, files);
            }
            else {
                files.push({
                    source: BackupSource.PersistentMemory,
                    absolutePath: abs,
                    relativePath: path.relative(this.storageRoot, abs).replace(/\\/g, "/"),
                });
            }
        }
        return files;
    }
    walkDirectory(dir, storageRoot, source, files) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                this.walkDirectory(abs, storageRoot, source, files);
            }
            else if (entry.isFile()) {
                files.push({
                    source,
                    absolutePath: abs,
                    relativePath: path.relative(storageRoot, abs).replace(/\\/g, "/"),
                });
            }
        }
    }
}
//# sourceMappingURL=backup-source-scanner.js.map