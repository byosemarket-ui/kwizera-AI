import fs from "node:fs";
export class KnowledgeIntegrityChecker {
    logger;
    validator;
    store;
    index;
    versionManager;
    constructor(logger, validator, store, index, versionManager) {
        this.logger = logger;
        this.validator = validator;
        this.store = store;
        this.index = index;
        this.versionManager = versionManager;
    }
    runFullCheck() {
        const issues = [];
        let recordsChecked = 0;
        let relationshipsValid = true;
        let metadataAccurate = true;
        let versionIntegrity = true;
        let filesAvailable = true;
        for (const entry of this.index.getIndex().entries) {
            recordsChecked++;
            const recordPath = entry.storageLocation;
            if (!fs.existsSync(recordPath)) {
                issues.push(`Storage path missing for ${entry.knowledgeId}`);
                filesAvailable = false;
                continue;
            }
            if (!this.store.verifyRecordChecksum(recordPath)) {
                issues.push(`Checksum failed for ${entry.knowledgeId}`);
                metadataAccurate = false;
            }
            const { data } = this.store.readRecord(recordPath);
            if (!data) {
                issues.push(`Cannot read record ${entry.knowledgeId}`);
                filesAvailable = false;
                continue;
            }
            const integrity = this.validator.validateRecordIntegrity(data);
            if (!integrity.valid) {
                issues.push(...integrity.diagnostics.map((d) => `${entry.knowledgeId}: ${d}`));
                metadataAccurate = false;
            }
            for (const relatedId of data.relatedKnowledge) {
                if (relatedId !== entry.knowledgeId && !this.index.findById(relatedId)) {
                    issues.push(`Broken related knowledge link: ${entry.knowledgeId} -> ${relatedId}`);
                    relationshipsValid = false;
                }
            }
            if (entry.contentHash !== data.contentHash) {
                issues.push(`Index metadata mismatch for ${entry.knowledgeId}`);
                metadataAccurate = false;
            }
            const versions = this.versionManager.listVersions(recordPath);
            if (data.version > 1 && versions.length === 0) {
                issues.push(`Missing version history for ${entry.knowledgeId}`);
                versionIntegrity = false;
            }
        }
        const verified = issues.length === 0;
        this.logger.log(verified ? "info" : "warn", "integrity", "Knowledge integrity check complete", {
            recordsChecked,
            issues: issues.length,
        });
        return {
            verified,
            recordsChecked,
            issues,
            relationshipsValid,
            metadataAccurate,
            versionIntegrity,
            filesAvailable,
            timestamp: new Date().toISOString(),
        };
    }
    verifySingleRecord(record) {
        return (this.validator.validateRecordIntegrity(record).valid &&
            this.store.verifyRecordChecksum(record.storageLocation));
    }
}
//# sourceMappingURL=knowledge-integrity-checker.js.map