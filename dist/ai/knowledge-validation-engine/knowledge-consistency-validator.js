import { KnowledgeIntegrityStatus, KnowledgeRecordStatus, } from "../knowledge-storage-engine/types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
export class KnowledgeConsistencyValidator {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    async validateAll(repair = false) {
        const start = Date.now();
        const storage = this.foundation.getStorageEngine();
        const entries = storage.getIndexEntries();
        const indexIds = new Set(entries.map((e) => e.knowledgeId));
        const diagnostics = [];
        let repairsApplied = 0;
        const fingerprintGroups = new Map();
        for (const entry of entries) {
            const list = fingerprintGroups.get(entry.fingerprint) ?? [];
            list.push(entry.knowledgeId);
            fingerprintGroups.set(entry.fingerprint, list);
        }
        const duplicateGroups = [...fingerprintGroups.values()].filter((ids) => ids.length > 1).length;
        let conflictingRecords = 0;
        const titleMap = new Map();
        for (const entry of entries) {
            const key = `${entry.knowledgeType}:${entry.title.toLowerCase()}`;
            const list = titleMap.get(key) ?? [];
            list.push(entry.knowledgeId);
            titleMap.set(key, list);
        }
        for (const [, ids] of titleMap) {
            if (ids.length > 1) {
                const hashes = new Set(ids.map((id) => entries.find((e) => e.knowledgeId === id)?.contentHash));
                if (hashes.size > 1)
                    conflictingRecords++;
            }
        }
        let invalidReferences = 0;
        let orphanRecords = 0;
        for (const entry of entries) {
            let read;
            try {
                read = await storage.getRecord(entry.knowledgeId, "knowledge-validation-engine");
            }
            catch (error) {
                orphanRecords++;
                diagnostics.push(`Unreadable record: ${entry.knowledgeId} (${error instanceof Error ? error.message : String(error)})`);
                continue;
            }
            if (!read.success || !read.record) {
                orphanRecords++;
                diagnostics.push(`Unreadable record: ${entry.knowledgeId}`);
                continue;
            }
            const record = read.record;
            for (const relatedId of record.relatedKnowledge) {
                if (!indexIds.has(relatedId)) {
                    invalidReferences++;
                    diagnostics.push(`Invalid reference ${relatedId} in ${entry.knowledgeId}`);
                    if (repair) {
                        const fixed = record.relatedKnowledge.filter((id) => indexIds.has(id) && id !== record.knowledgeId);
                        await storage.updateRecord(entry.knowledgeId, { relatedKnowledge: fixed }, "knowledge-validation-engine");
                        repairsApplied++;
                    }
                }
                if (relatedId === record.knowledgeId) {
                    invalidReferences++;
                    if (repair) {
                        const fixed = record.relatedKnowledge.filter((id) => id !== record.knowledgeId);
                        await storage.updateRecord(entry.knowledgeId, { relatedKnowledge: fixed }, "knowledge-validation-engine");
                        repairsApplied++;
                    }
                }
            }
        }
        if (repair) {
            const graphIntegrity = this.foundation.getGraphEngine().validateIntegrity();
            repairsApplied += graphIntegrity.issuesRepaired;
            diagnostics.push(...graphIntegrity.diagnostics.map((d) => d.detail));
        }
        const result = {
            valid: duplicateGroups === 0 && conflictingRecords === 0 && invalidReferences === 0 && orphanRecords === 0,
            duplicateGroups,
            conflictingRecords,
            orphanRecords,
            invalidReferences,
            repairsApplied,
            diagnostics,
            durationMs: Date.now() - start,
        };
        this.logger.log("info", "consistency", "Consistency validation complete", {
            duplicateGroups,
            conflictingRecords,
            repairsApplied,
        });
        return result;
    }
    async rejectInvalidRecords() {
        const storage = this.foundation.getStorageEngine();
        let rejected = 0;
        for (const entry of storage.getIndexEntries()) {
            let read;
            try {
                read = await storage.getRecord(entry.knowledgeId, "knowledge-validation-engine");
            }
            catch (error) {
                rejected++;
                this.logger.log("warn", "rejection", "Unreadable knowledge rejected", {
                    knowledgeId: entry.knowledgeId,
                    error: error instanceof Error ? error.message : String(error),
                });
                continue;
            }
            if (!read.success || !read.record) {
                continue;
            }
            const record = read.record;
            if (record.integrityStatus === KnowledgeIntegrityStatus.Corrupted ||
                (record.qualityScore < 30 && record.confidenceScore < 30)) {
                await storage.updateRecord(entry.knowledgeId, {
                    status: KnowledgeRecordStatus.Rejected,
                    verificationStatus: KnowledgeVerificationStatus.Rejected,
                    tags: [...record.tags, "validation-rejected"],
                }, "knowledge-validation-engine");
                rejected++;
                this.logger.log("warn", "rejection", "Invalid knowledge rejected", {
                    knowledgeId: entry.knowledgeId,
                });
            }
        }
        return rejected;
    }
}
//# sourceMappingURL=knowledge-consistency-validator.js.map