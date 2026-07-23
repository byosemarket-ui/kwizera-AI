import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { RelationshipType } from "./types.js";
export class RelationshipDiscovery {
    foundation;
    graph;
    logger;
    constructor(foundation, graph, logger) {
        this.foundation = foundation;
        this.graph = graph;
        this.logger = logger;
    }
    async discover(memoryId) {
        const start = Date.now();
        let discovered = 0;
        let updated = 0;
        const storage = this.foundation.getStorageEngine();
        const indexEngine = this.foundation.getIndexEngine();
        const entries = memoryId
            ? [storage.findIndexEntry(memoryId)].filter(Boolean)
            : storage.getIndexEntries();
        for (const entry of entries) {
            if (!entry)
                continue;
            const read = await storage.getRecord(entry.memoryId);
            if (!read.success || !read.record)
                continue;
            const record = read.record;
            this.graph.ensureNode(record.memoryId, record.memoryType);
            if (record.relatedProject && record.relatedProject !== record.memoryId) {
                const projectEntry = storage.findIndexEntry(record.relatedProject);
                if (projectEntry) {
                    const edge = this.graph.createEdge(record.relatedProject, record.memoryId, MemoryStorageType.Project, record.memoryType, RelationshipType.ParentChild, "Memory belongs to project", 80, 90);
                    if (edge)
                        discovered++;
                    else
                        updated++;
                }
            }
            if (record.relatedProject) {
                const byProject = indexEngine.lookup({ project: record.relatedProject });
                for (const relatedId of byProject.memoryIds) {
                    if (relatedId === record.memoryId)
                        continue;
                    const relatedEntry = storage.findIndexEntry(relatedId);
                    if (!relatedEntry)
                        continue;
                    const edge = this.graph.createEdge(record.memoryId, relatedId, record.memoryType, relatedEntry.memoryType, RelationshipType.Related, `Shared project: ${record.relatedProject}`, 70, 85);
                    if (edge)
                        discovered++;
                }
            }
            for (const tag of record.tags) {
                if (tag.toLowerCase().includes("brand")) {
                    const byBrand = indexEngine.lookup({ brand: tag });
                    for (const relatedId of byBrand.memoryIds) {
                        if (relatedId === record.memoryId)
                            continue;
                        const relatedEntry = storage.findIndexEntry(relatedId);
                        if (!relatedEntry)
                            continue;
                        const edge = this.graph.createEdge(record.memoryId, relatedId, record.memoryType, relatedEntry.memoryType, RelationshipType.Similar, `Shared brand tag: ${tag}`, 65, 75);
                        if (edge)
                            discovered++;
                    }
                }
                const byTag = indexEngine.lookup({ tags: [tag] });
                for (const relatedId of byTag.memoryIds) {
                    if (relatedId === record.memoryId)
                        continue;
                    const edge = this.graph.createEdge(record.memoryId, relatedId, record.memoryType, storage.findIndexEntry(relatedId)?.memoryType ?? MemoryStorageType.Project, RelationshipType.FrequentlyUsedTogether, `Shared tag: ${tag}`, 55, 70);
                    if (edge)
                        discovered++;
                }
            }
            if (record.category) {
                const byCategory = indexEngine.lookup({ category: record.category });
                for (const relatedId of byCategory.memoryIds) {
                    if (relatedId === record.memoryId)
                        continue;
                    const relatedEntry = storage.findIndexEntry(relatedId);
                    if (!relatedEntry || relatedEntry.memoryType !== record.memoryType)
                        continue;
                    const edge = this.graph.createEdge(record.memoryId, relatedId, record.memoryType, relatedEntry.memoryType, RelationshipType.Similar, `Same category: ${record.category}`, 60, 75);
                    if (edge)
                        discovered++;
                }
            }
            const indexRelated = indexEngine.getRelated(record.memoryId);
            for (const relatedId of indexRelated) {
                const relatedEntry = storage.findIndexEntry(relatedId);
                if (!relatedEntry)
                    continue;
                const edge = this.graph.createEdge(record.memoryId, relatedId, record.memoryType, relatedEntry.memoryType, RelationshipType.Reference, "Index relationship reference", 60, 80);
                if (edge)
                    discovered++;
            }
        }
        this.logger.log("info", "discovery", "Relationship discovery complete", {
            discovered,
            memoryId,
            durationMs: Date.now() - start,
        });
        return { discovered, updated, durationMs: Date.now() - start };
    }
}
//# sourceMappingURL=relationship-discovery.js.map