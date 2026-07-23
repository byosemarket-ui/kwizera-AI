export class DuplicateDetector {
    logger;
    validator;
    constructor(logger, validator) {
        this.logger = logger;
        this.validator = validator;
    }
    checkDuplicate(index, entry, allowSameIdUpdate = false) {
        const existingById = index.entries.find((e) => e.memoryId === entry.memoryId);
        if (existingById && !allowSameIdUpdate) {
            this.logger.log("warn", "duplicate", "Duplicate memory ID detected", { memoryId: entry.memoryId });
            return { isDuplicate: true, reason: `Memory ID already exists: ${entry.memoryId}` };
        }
        const fingerprint = this.validator.computeFingerprint(entry.memoryType, entry.title, entry.source, entry.contentHash);
        const existingByFingerprint = index.entries.find((e) => e.fingerprint === fingerprint && e.memoryId !== entry.memoryId);
        if (existingByFingerprint) {
            this.logger.log("warn", "duplicate", "Duplicate content fingerprint detected", {
                memoryId: entry.memoryId,
                existingId: existingByFingerprint.memoryId,
            });
            return {
                isDuplicate: true,
                reason: `Duplicate content matches existing record: ${existingByFingerprint.memoryId}`,
            };
        }
        return { isDuplicate: false };
    }
    buildIndexEntry(record) {
        return {
            memoryId: record.memoryId,
            memoryType: record.memoryType,
            title: record.title,
            category: record.category,
            source: record.source,
            contentHash: record.contentHash,
            fingerprint: this.validator.computeFingerprint(record.memoryType, record.title, record.source, record.contentHash),
            version: record.version,
            storageLocation: record.storageLocation,
            lastUpdate: record.lastUpdate,
            searchableText: record.searchableText,
        };
    }
}
//# sourceMappingURL=duplicate-detector.js.map