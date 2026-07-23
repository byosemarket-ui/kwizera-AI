/**
 * KWIZERA AI STUDIO — Knowledge Storage Engine types (Step 4B)
 */
export var KnowledgeStorageType;
(function (KnowledgeStorageType) {
    KnowledgeStorageType["Product"] = "product-knowledge";
    KnowledgeStorageType["Image"] = "image-knowledge";
    KnowledgeStorageType["Video"] = "video-knowledge";
    KnowledgeStorageType["Marketing"] = "marketing-knowledge";
    KnowledgeStorageType["Brand"] = "brand-knowledge";
    KnowledgeStorageType["Language"] = "language-knowledge";
    KnowledgeStorageType["Creative"] = "creative-knowledge";
    KnowledgeStorageType["Technical"] = "technical-knowledge";
    KnowledgeStorageType["Business"] = "business-knowledge";
    KnowledgeStorageType["Workflow"] = "workflow-knowledge";
    KnowledgeStorageType["Decision"] = "decision-knowledge";
    KnowledgeStorageType["Reasoning"] = "reasoning-knowledge";
    KnowledgeStorageType["Industry"] = "industry-knowledge";
})(KnowledgeStorageType || (KnowledgeStorageType = {}));
export var KnowledgeRecordStatus;
(function (KnowledgeRecordStatus) {
    KnowledgeRecordStatus["Active"] = "active";
    KnowledgeRecordStatus["Pending"] = "pending";
    KnowledgeRecordStatus["Verified"] = "verified";
    KnowledgeRecordStatus["Archived"] = "archived";
    KnowledgeRecordStatus["Rejected"] = "rejected";
    KnowledgeRecordStatus["Deleted"] = "deleted";
})(KnowledgeRecordStatus || (KnowledgeRecordStatus = {}));
export var KnowledgeIntegrityStatus;
(function (KnowledgeIntegrityStatus) {
    KnowledgeIntegrityStatus["Verified"] = "verified";
    KnowledgeIntegrityStatus["Unverified"] = "unverified";
    KnowledgeIntegrityStatus["Corrupted"] = "corrupted";
    KnowledgeIntegrityStatus["PendingVerification"] = "pending-verification";
})(KnowledgeIntegrityStatus || (KnowledgeIntegrityStatus = {}));
export var KnowledgeStorageValidationCode;
(function (KnowledgeStorageValidationCode) {
    KnowledgeStorageValidationCode["MissingRequiredField"] = "missing-required-field";
    KnowledgeStorageValidationCode["InvalidData"] = "invalid-data";
    KnowledgeStorageValidationCode["CorruptedRecord"] = "corrupted-record";
    KnowledgeStorageValidationCode["DuplicateRecord"] = "duplicate-record";
    KnowledgeStorageValidationCode["StorageUnavailable"] = "storage-unavailable";
    KnowledgeStorageValidationCode["AccessDenied"] = "access-denied";
    KnowledgeStorageValidationCode["LowQuality"] = "low-quality";
    KnowledgeStorageValidationCode["UnverifiedKnowledge"] = "unverified-knowledge";
})(KnowledgeStorageValidationCode || (KnowledgeStorageValidationCode = {}));
export class KnowledgeStorageEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "KnowledgeStorageEngineError";
    }
}
//# sourceMappingURL=types.js.map