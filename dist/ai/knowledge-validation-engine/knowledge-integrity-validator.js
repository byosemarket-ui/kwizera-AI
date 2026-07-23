import { KnowledgeIntegrityStatus, KnowledgeRecordStatus } from "../knowledge-storage-engine/types.js";
export class KnowledgeIntegrityValidator {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    async validateAll() {
        const start = Date.now();
        const storage = this.foundation.getStorageEngine();
        const diagnostics = [];
        let corruptedRecords = 0;
        let checksumFailures = 0;
        let versionIntegrityFailures = 0;
        let storageCheck;
        try {
            storageCheck = storage.runIntegrityCheck();
        }
        catch (error) {
            storageCheck = {
                verified: false,
                recordsChecked: storage.getIndexEntries().length,
                issues: [error instanceof Error ? error.message : String(error)],
                relationshipsValid: false,
                metadataAccurate: false,
                versionIntegrity: false,
                filesAvailable: false,
                timestamp: new Date().toISOString(),
            };
        }
        if (!storageCheck.verified) {
            diagnostics.push(...storageCheck.issues);
        }
        for (const entry of storage.getIndexEntries()) {
            let read;
            try {
                read = await storage.getRecord(entry.knowledgeId, "knowledge-validation-engine");
            }
            catch (error) {
                corruptedRecords++;
                diagnostics.push(`Unreadable record: ${entry.knowledgeId} (${error instanceof Error ? error.message : String(error)})`);
                continue;
            }
            if (!read.success || !read.record) {
                corruptedRecords++;
                diagnostics.push(`Unreadable record: ${entry.knowledgeId}`);
                continue;
            }
            const record = read.record;
            if (record.integrityStatus === KnowledgeIntegrityStatus.Corrupted) {
                corruptedRecords++;
                diagnostics.push(`Corrupted record: ${entry.knowledgeId}`);
            }
            try {
                if (!storage.verifyRecordChecksum(entry.knowledgeId)) {
                    checksumFailures++;
                    diagnostics.push(`Checksum failure: ${entry.knowledgeId}`);
                }
            }
            catch (error) {
                checksumFailures++;
                diagnostics.push(`Checksum verification error for ${entry.knowledgeId}: ${error instanceof Error ? error.message : String(error)}`);
            }
            const integrity = storage.validateRecordIntegrity(record);
            if (!integrity.valid) {
                versionIntegrityFailures++;
                diagnostics.push(...integrity.diagnostics.map((d) => `${entry.knowledgeId}: ${d}`));
            }
            if (record.status === KnowledgeRecordStatus.Deleted) {
                diagnostics.push(`Deleted record still indexed: ${entry.knowledgeId}`);
            }
        }
        const result = {
            valid: corruptedRecords === 0 && checksumFailures === 0 && versionIntegrityFailures === 0 && storageCheck.verified,
            recordsChecked: storage.getIndexEntries().length,
            corruptedRecords,
            checksumFailures,
            versionIntegrityFailures,
            diagnostics,
            durationMs: Date.now() - start,
        };
        this.logger.log("info", "integrity", "Integrity validation complete", {
            valid: result.valid,
            recordsChecked: result.recordsChecked,
            corruptedRecords,
        });
        return result;
    }
    async quarantineCorruptRecords() {
        const storage = this.foundation.getStorageEngine();
        let quarantined = 0;
        for (const entry of storage.getIndexEntries()) {
            let unreadable = false;
            try {
                const read = await storage.getRecord(entry.knowledgeId, "knowledge-validation-engine");
                unreadable = !read.success || !read.record;
            }
            catch {
                unreadable = true;
            }
            if (unreadable) {
                const repaired = await storage.quarantineUnreadableRecord(entry.knowledgeId, "knowledge-validation-engine");
                if (repaired) {
                    quarantined++;
                    this.logger.log("warn", "repair", "Corrupt record quarantined", {
                        knowledgeId: entry.knowledgeId,
                    });
                }
            }
        }
        if (quarantined > 0) {
            storage.runIntegrityCheck();
        }
        return quarantined;
    }
}
//# sourceMappingURL=knowledge-integrity-validator.js.map