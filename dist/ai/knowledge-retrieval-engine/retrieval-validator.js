import { KnowledgeIntegrityStatus } from "../knowledge-storage-engine/types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
export class KnowledgeRetrievalValidator {
    logger;
    storageEngine;
    constructor(logger, storageEngine) {
        this.logger = logger;
        this.storageEngine = storageEngine;
    }
    async validateForRetrieval(knowledgeId, requesterId) {
        const diagnostics = [];
        const indexEntry = this.storageEngine.findIndexEntry(knowledgeId);
        if (!indexEntry) {
            diagnostics.push(`Knowledge not found in index: ${knowledgeId}`);
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: "Run knowledge storage integrity check and verify index synchronization",
            };
        }
        if (!this.storageEngine.isStorageAvailable()) {
            diagnostics.push("Storage is unavailable");
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: "Verify storage root accessibility at D:\\KWIZERA-AI-STUDIO",
            };
        }
        const read = await this.storageEngine.getRecord(knowledgeId, requesterId);
        if (!read.success || !read.record) {
            diagnostics.push(read.message ?? "Failed to read knowledge record");
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: "Attempt recovery via Knowledge Foundation or restore from version history",
            };
        }
        const record = read.record;
        if (record.integrityStatus === KnowledgeIntegrityStatus.Corrupted) {
            diagnostics.push("Knowledge record is corrupted");
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: `Restore version from ${record.storageLocation}/versions/`,
            };
        }
        if (!this.storageEngine.verifyRecordChecksum(knowledgeId)) {
            diagnostics.push("Record checksum verification failed");
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: "Re-run storage integrity check and restore from version history",
            };
        }
        const integrity = this.storageEngine.validateRecordIntegrity(record);
        if (!integrity.valid) {
            diagnostics.push(...integrity.diagnostics);
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: "Restore previous version or re-index knowledge record",
            };
        }
        if (record.verificationStatus === KnowledgeVerificationStatus.Rejected) {
            diagnostics.push("Knowledge record has been rejected and is not retrievable");
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: "Review knowledge quality and update verification status",
            };
        }
        for (const relatedId of record.relatedKnowledge) {
            if (relatedId === knowledgeId) {
                diagnostics.push("Self-referential related knowledge link detected");
            }
        }
        if (diagnostics.length > 0) {
            return {
                valid: false,
                diagnostics,
                recoverySuggestion: "Fix relationship integrity before retrieval",
            };
        }
        return { valid: true, diagnostics: [] };
    }
    validateRecord(record) {
        if (record.integrityStatus === KnowledgeIntegrityStatus.Corrupted) {
            this.logger.log("warn", "validation", "Corrupted record detected", { knowledgeId: record.knowledgeId });
            return {
                valid: false,
                diagnostics: ["Record integrity status is corrupted"],
                recoverySuggestion: "Restore from version history",
            };
        }
        return { valid: true, diagnostics: [] };
    }
}
export function isKnowledgeRetrievable(record) {
    return (record.integrityStatus === KnowledgeIntegrityStatus.Verified ||
        record.integrityStatus === KnowledgeIntegrityStatus.Unverified ||
        record.integrityStatus === KnowledgeIntegrityStatus.PendingVerification);
}
//# sourceMappingURL=retrieval-validator.js.map