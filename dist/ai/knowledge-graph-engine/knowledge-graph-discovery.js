import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeNodeType, KnowledgeRelationType } from "./types.js";
const TYPE_AFFINITY = {
    [KnowledgeStorageType.Product]: [
        KnowledgeStorageType.Marketing,
        KnowledgeStorageType.Video,
        KnowledgeStorageType.Brand,
        KnowledgeStorageType.Image,
    ],
    [KnowledgeStorageType.Video]: [KnowledgeStorageType.Marketing, KnowledgeStorageType.Product, KnowledgeStorageType.Creative],
    [KnowledgeStorageType.Decision]: [KnowledgeStorageType.Reasoning, KnowledgeStorageType.Workflow],
    [KnowledgeStorageType.Reasoning]: [KnowledgeStorageType.Decision, KnowledgeStorageType.Industry],
    [KnowledgeStorageType.Marketing]: [KnowledgeStorageType.Product, KnowledgeStorageType.Brand],
    [KnowledgeStorageType.Workflow]: [KnowledgeStorageType.Decision, KnowledgeStorageType.Technical],
};
export class KnowledgeGraphDiscovery {
    foundation;
    graph;
    logger;
    constructor(foundation, graph, logger) {
        this.foundation = foundation;
        this.graph = graph;
        this.logger = logger;
    }
    async discover(knowledgeId) {
        const start = Date.now();
        let discovered = 0;
        let updated = 0;
        let nodesCreated = 0;
        const storage = this.foundation.getStorageEngine();
        const entries = knowledgeId
            ? [storage.findIndexEntry(knowledgeId)].filter(Boolean)
            : storage.getIndexEntries();
        this.graph.setBatchPersist(true);
        try {
            for (const entry of entries) {
                if (!entry)
                    continue;
                const read = await storage.getRecord(entry.knowledgeId);
                if (!read.success || !read.record)
                    continue;
                const record = read.record;
                const existing = this.graph.getNode(record.knowledgeId);
                this.graph.ensureKnowledgeNode(record.knowledgeId, record.knowledgeType, record.title, record.searchableText);
                if (!existing)
                    nodesCreated++;
                discovered += this.discoverExplicitLinks(record);
                discovered += this.discoverMemoryLinks(record);
                discovered += this.discoverTagLinks(record, storage.getIndexEntries());
                discovered += this.discoverTypeAffinity(record, storage.getIndexEntries());
                discovered += this.discoverTopicLinks(record, storage.getIndexEntries());
                void updated;
            }
        }
        finally {
            this.graph.setBatchPersist(false);
        }
        this.logger.log("info", "discovery", "Knowledge graph discovery complete", {
            discovered,
            nodesCreated,
            knowledgeId,
            durationMs: Date.now() - start,
        });
        return { discovered, updated, nodesCreated, durationMs: Date.now() - start };
    }
    discoverExplicitLinks(record) {
        let count = 0;
        for (const relatedId of record.relatedKnowledge) {
            if (relatedId === record.knowledgeId)
                continue;
            const edge = this.graph.createEdge(record.knowledgeId, relatedId, KnowledgeRelationType.RelatedTo, `Explicit relatedKnowledge link on ${record.knowledgeId}`, 85, 90);
            if (edge)
                count++;
        }
        return count;
    }
    discoverMemoryLinks(record) {
        let count = 0;
        for (const memoryId of record.relatedMemory) {
            const nodeType = memoryId.includes("project")
                ? KnowledgeNodeType.Project
                : KnowledgeNodeType.MemoryObject;
            this.graph.ensureNode(memoryId, nodeType, memoryId, memoryId.toLowerCase());
            const edge = this.graph.createEdge(record.knowledgeId, memoryId, KnowledgeRelationType.BelongsTo, `Knowledge linked to memory object: ${memoryId}`, 75, 85);
            if (edge)
                count++;
        }
        return count;
    }
    discoverTagLinks(record, allEntries) {
        let count = 0;
        for (const tag of record.tags) {
            for (const entry of allEntries) {
                if (entry.knowledgeId === record.knowledgeId)
                    continue;
                if (!entry.searchableText.includes(tag.toLowerCase()))
                    continue;
                const edge = this.graph.createEdge(record.knowledgeId, entry.knowledgeId, KnowledgeRelationType.FrequentlyUsedTogether, `Shared tag evidence: ${tag}`, 60, 75);
                if (edge)
                    count++;
            }
        }
        return count;
    }
    discoverTypeAffinity(record, allEntries) {
        let count = 0;
        const relatedTypes = TYPE_AFFINITY[record.knowledgeType] ?? [];
        for (const entry of allEntries) {
            if (entry.knowledgeId === record.knowledgeId)
                continue;
            if (!relatedTypes.includes(entry.knowledgeType))
                continue;
            const sharedKeywords = record.keywords.filter((k) => entry.searchableText.includes(k.toLowerCase()));
            if (sharedKeywords.length === 0 && record.category !== entry.searchableText.split(" ")[0]) {
                continue;
            }
            const edge = this.graph.createEdge(record.knowledgeId, entry.knowledgeId, KnowledgeRelationType.RecommendedWith, `Type affinity ${record.knowledgeType} → ${entry.knowledgeType}`, 55 + sharedKeywords.length * 5, 70);
            if (edge)
                count++;
        }
        return count;
    }
    discoverTopicLinks(record, allEntries) {
        let count = 0;
        const topic = record.classification.topic.toLowerCase();
        if (!topic)
            return 0;
        for (const entry of allEntries) {
            if (entry.knowledgeId === record.knowledgeId)
                continue;
            if (entry.topic.toLowerCase() !== topic && !entry.searchableText.includes(topic))
                continue;
            const edge = this.graph.createEdge(record.knowledgeId, entry.knowledgeId, KnowledgeRelationType.SimilarTo, `Shared topic: ${topic}`, 65, 80);
            if (edge)
                count++;
        }
        return count;
    }
}
//# sourceMappingURL=knowledge-graph-discovery.js.map