export class KnowledgeDuplicateDetector {
    logger;
    validator;
    constructor(logger, validator) {
        this.logger = logger;
        this.validator = validator;
    }
    checkDuplicate(index, entry, allowSameIdUpdate = false) {
        const existingById = index.entries.find((e) => e.knowledgeId === entry.knowledgeId);
        if (existingById && !allowSameIdUpdate) {
            this.logger.log("warn", "duplicate", "Duplicate knowledge ID detected", {
                knowledgeId: entry.knowledgeId,
            });
            return { isDuplicate: true, reason: `Knowledge ID already exists: ${entry.knowledgeId}` };
        }
        const fingerprint = this.validator.computeFingerprint(entry.knowledgeType, entry.title, entry.source, entry.contentHash);
        const existingByFingerprint = index.entries.find((e) => e.fingerprint === fingerprint && e.knowledgeId !== entry.knowledgeId);
        if (existingByFingerprint) {
            this.logger.log("warn", "duplicate", "Duplicate content fingerprint detected", {
                knowledgeId: entry.knowledgeId,
                existingId: existingByFingerprint.knowledgeId,
            });
            return {
                isDuplicate: true,
                reason: `Duplicate content matches existing record: ${existingByFingerprint.knowledgeId}`,
            };
        }
        const semanticKey = this.buildSemanticKey(entry.knowledgeType, entry.title, entry.source);
        const existingBySemantic = index.entries.find((e) => e.knowledgeId !== entry.knowledgeId &&
            this.buildSemanticKey(e.knowledgeType, e.title, e.source) === semanticKey);
        if (existingBySemantic) {
            this.logger.log("warn", "duplicate", "Duplicate semantic knowledge match detected", {
                knowledgeId: entry.knowledgeId,
                existingId: existingBySemantic.knowledgeId,
            });
            return {
                isDuplicate: true,
                reason: `Duplicate knowledge matches existing record: ${existingBySemantic.knowledgeId}`,
            };
        }
        return { isDuplicate: false };
    }
    buildSemanticKey(knowledgeType, title, source) {
        return `${knowledgeType}:${title.trim().toLowerCase()}:${source.trim().toLowerCase()}`;
    }
    buildIndexEntry(record) {
        return {
            knowledgeId: record.knowledgeId,
            knowledgeType: record.knowledgeType,
            title: record.title,
            category: record.category,
            source: record.source,
            contentHash: record.contentHash,
            fingerprint: this.validator.computeFingerprint(record.knowledgeType, record.title, record.source, record.contentHash),
            version: record.version,
            storageLocation: record.storageLocation,
            lastUpdated: record.lastUpdated,
            searchableText: record.searchableText,
            topic: record.classification.topic,
            importance: record.classification.importance,
            verificationStatus: record.verificationStatus,
        };
    }
}
//# sourceMappingURL=knowledge-duplicate-detector.js.map