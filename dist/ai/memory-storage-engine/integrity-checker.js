import fs from "node:fs";
export class IntegrityChecker {
    logger;
    validator;
    store;
    index;
    constructor(logger, validator, store, index) {
        this.logger = logger;
        this.validator = validator;
        this.store = store;
        this.index = index;
    }
    runFullCheck() {
        const issues = [];
        let recordsChecked = 0;
        let relationshipsValid = true;
        let metadataAccurate = true;
        let filesAvailable = true;
        for (const entry of this.index.getIndex().entries) {
            recordsChecked++;
            const recordPath = entry.storageLocation;
            if (!fs.existsSync(recordPath)) {
                issues.push(`Storage path missing for ${entry.memoryId}`);
                filesAvailable = false;
                continue;
            }
            if (!this.store.verifyRecordChecksum(recordPath)) {
                issues.push(`Checksum failed for ${entry.memoryId}`);
                metadataAccurate = false;
            }
            const { data } = this.store.readRecord(recordPath);
            if (!data) {
                issues.push(`Cannot read record ${entry.memoryId}`);
                filesAvailable = false;
                continue;
            }
            const integrity = this.validator.validateRecordIntegrity(data);
            if (!integrity.valid) {
                issues.push(...integrity.diagnostics.map((d) => `${entry.memoryId}: ${d}`));
                metadataAccurate = false;
            }
            if (data.relatedProject && data.relatedFiles.length === 0) {
                relationshipsValid = relationshipsValid && true;
            }
            if (entry.contentHash !== data.contentHash) {
                issues.push(`Index metadata mismatch for ${entry.memoryId}`);
                metadataAccurate = false;
            }
        }
        const verified = issues.length === 0;
        this.logger.log(verified ? "info" : "warn", "integrity", "Integrity check complete", {
            recordsChecked,
            issues: issues.length,
        });
        return {
            verified,
            recordsChecked,
            issues,
            relationshipsValid,
            metadataAccurate,
            filesAvailable,
            timestamp: new Date().toISOString(),
        };
    }
    verifySingleRecord(record) {
        return this.validator.validateRecordIntegrity(record).valid &&
            this.store.verifyRecordChecksum(record.storageLocation);
    }
}
//# sourceMappingURL=integrity-checker.js.map