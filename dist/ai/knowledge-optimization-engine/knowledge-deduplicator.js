import { KnowledgeRecordStatus } from "../knowledge-storage-engine/types.js";
export class KnowledgeDeduplicator {
    foundation;
    tierManager;
    logger;
    constructor(foundation, tierManager, logger) {
        this.foundation = foundation;
        this.tierManager = tierManager;
        this.logger = logger;
    }
    detectDuplicates() {
        const storage = this.foundation.getStorageEngine();
        const entries = storage.getIndexEntries();
        const groups = new Map();
        for (const entry of entries) {
            const list = groups.get(entry.fingerprint) ?? [];
            list.push(entry.knowledgeId);
            groups.set(entry.fingerprint, list);
        }
        const duplicates = [];
        for (const [fingerprint, knowledgeIds] of groups) {
            if (knowledgeIds.length < 2)
                continue;
            duplicates.push({
                fingerprint,
                knowledgeIds,
                primaryId: knowledgeIds[0],
                conflictScore: knowledgeIds.length,
            });
        }
        this.logger.log("info", "duplicate", "Duplicate detection complete", {
            groups: duplicates.length,
        });
        return duplicates;
    }
    async mergeDuplicates() {
        const start = Date.now();
        const storage = this.foundation.getStorageEngine();
        const groups = this.detectDuplicates();
        const preserved = [];
        const archived = [];
        for (const group of groups) {
            const scored = await Promise.all(group.knowledgeIds.map(async (id) => {
                const read = await storage.getRecord(id, "knowledge-optimization-engine");
                return { id, quality: read.record?.qualityScore ?? 0 };
            }));
            scored.sort((a, b) => b.quality - a.quality);
            const primaryId = scored[0].id;
            preserved.push(primaryId);
            for (const knowledgeId of group.knowledgeIds) {
                if (knowledgeId === primaryId)
                    continue;
                const read = await storage.getRecord(knowledgeId, "knowledge-optimization-engine");
                if (!read.success || !read.record)
                    continue;
                const primaryRead = await storage.getRecord(primaryId, "knowledge-optimization-engine");
                if (primaryRead.success && primaryRead.record) {
                    const mergedTags = [...new Set([...primaryRead.record.tags, ...read.record.tags])];
                    const mergedKeywords = [
                        ...new Set([...primaryRead.record.keywords, ...read.record.keywords]),
                    ];
                    const mergedRelated = [
                        ...new Set([
                            ...primaryRead.record.relatedKnowledge,
                            ...read.record.relatedKnowledge,
                            knowledgeId,
                        ]),
                    ];
                    await storage.updateRecord(primaryId, {
                        tags: mergedTags,
                        keywords: mergedKeywords,
                        relatedKnowledge: mergedRelated,
                        payload: {
                            ...primaryRead.record.payload,
                            mergedFrom: [
                                ...(primaryRead.record.payload?.mergedFrom ?? []),
                                knowledgeId,
                            ],
                            mergeHistory: [
                                ...(primaryRead.record.payload?.mergeHistory ?? []),
                                `${new Date().toISOString()}:merged-${knowledgeId}`,
                            ],
                        },
                    }, "knowledge-optimization-engine");
                }
                await storage.updateRecord(knowledgeId, {
                    status: KnowledgeRecordStatus.Archived,
                    tags: [...read.record.tags, "merged-duplicate"],
                }, "knowledge-optimization-engine");
                this.tierManager.markArchived(knowledgeId);
                archived.push(knowledgeId);
            }
        }
        this.logger.log("info", "duplicate", "Duplicate merge complete", {
            merged: archived.length,
            preserved: preserved.length,
        });
        return {
            merged: archived.length,
            preserved,
            archived,
            durationMs: Date.now() - start,
        };
    }
}
//# sourceMappingURL=knowledge-deduplicator.js.map