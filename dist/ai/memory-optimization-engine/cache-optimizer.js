import fs from "node:fs";
import path from "node:path";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryTier } from "./types.js";
const CACHE_WARM_LIMIT = 20;
export class CacheOptimizer {
    foundation;
    tierManager;
    logger;
    priorityPath = "";
    constructor(foundation, tierManager, logger) {
        this.foundation = foundation;
        this.tierManager = tierManager;
        this.logger = logger;
    }
    initialize(optimizationDir) {
        this.priorityPath = path.join(optimizationDir, "cache-priority.json");
    }
    async optimize() {
        const start = Date.now();
        const retrieval = this.foundation.getRetrievalEngine();
        const relationshipEngine = this.foundation.getRelationshipMemoryEngine();
        const frequent = this.tierManager.getByTier(MemoryTier.FrequentlyUsed);
        const active = this.tierManager.getByTier(MemoryTier.Active);
        const learning = this.tierManager.getByTier(MemoryTier.Learning);
        const prioritySet = new Set();
        for (const assignment of [...frequent, ...active, ...learning].slice(0, CACHE_WARM_LIMIT)) {
            prioritySet.add(assignment.memoryId);
        }
        for (const type of [
            MemoryStorageType.Project,
            MemoryStorageType.Product,
            MemoryStorageType.Video,
            MemoryStorageType.Marketing,
            MemoryStorageType.Learning,
        ]) {
            const entries = this.foundation
                .getStorageEngine()
                .getIndexEntries()
                .filter((e) => e.memoryType === type)
                .slice(0, 5);
            for (const entry of entries) {
                prioritySet.add(entry.memoryId);
            }
        }
        const priorityIds = [...prioritySet].slice(0, CACHE_WARM_LIMIT);
        let warmed = 0;
        for (const memoryId of priorityIds) {
            const response = await retrieval.retrieve(memoryId, "memory-optimization-engine");
            if (response.success)
                warmed++;
            const recs = relationshipEngine.getRecommendations(memoryId, 3);
            for (const rec of recs.all) {
                await retrieval.retrieve(rec.memoryId, "memory-optimization-engine");
            }
        }
        fs.writeFileSync(this.priorityPath, JSON.stringify({ priorityIds, warmedAt: new Date().toISOString(), warmed }, null, 2), "utf8");
        this.logger.log("info", "cache", "Cache optimization complete", {
            warmed,
            priorityCount: priorityIds.length,
        });
        return { warmed, priorityIds, durationMs: Date.now() - start };
    }
    getPriorityPath() {
        return this.priorityPath;
    }
}
//# sourceMappingURL=cache-optimizer.js.map