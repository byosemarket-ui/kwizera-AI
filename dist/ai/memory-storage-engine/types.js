/**
 * KWIZERA AI STUDIO — Memory Storage Engine types (Step 3B)
 */
export var MemoryStorageType;
(function (MemoryStorageType) {
    MemoryStorageType["Project"] = "project-memory";
    MemoryStorageType["Product"] = "product-memory";
    MemoryStorageType["Video"] = "video-memory";
    MemoryStorageType["Marketing"] = "marketing-memory";
    MemoryStorageType["Knowledge"] = "knowledge-memory";
    MemoryStorageType["Learning"] = "learning-memory";
    MemoryStorageType["Language"] = "language-memory";
    MemoryStorageType["Workflow"] = "workflow-memory";
    MemoryStorageType["Decision"] = "decision-memory";
    MemoryStorageType["Reasoning"] = "reasoning-memory";
    MemoryStorageType["UserPreference"] = "user-preference-memory";
    MemoryStorageType["System"] = "system-memory";
})(MemoryStorageType || (MemoryStorageType = {}));
export var MemoryRecordStatus;
(function (MemoryRecordStatus) {
    MemoryRecordStatus["Active"] = "active";
    MemoryRecordStatus["Archived"] = "archived";
    MemoryRecordStatus["Pending"] = "pending";
    MemoryRecordStatus["Deleted"] = "deleted";
})(MemoryRecordStatus || (MemoryRecordStatus = {}));
export var MemoryIntegrityStatus;
(function (MemoryIntegrityStatus) {
    MemoryIntegrityStatus["Verified"] = "verified";
    MemoryIntegrityStatus["Unverified"] = "unverified";
    MemoryIntegrityStatus["Corrupted"] = "corrupted";
    MemoryIntegrityStatus["PendingVerification"] = "pending-verification";
})(MemoryIntegrityStatus || (MemoryIntegrityStatus = {}));
export var StorageValidationCode;
(function (StorageValidationCode) {
    StorageValidationCode["MissingRequiredField"] = "missing-required-field";
    StorageValidationCode["InvalidData"] = "invalid-data";
    StorageValidationCode["CorruptedRecord"] = "corrupted-record";
    StorageValidationCode["DuplicateRecord"] = "duplicate-record";
    StorageValidationCode["StorageUnavailable"] = "storage-unavailable";
    StorageValidationCode["AccessDenied"] = "access-denied";
})(StorageValidationCode || (StorageValidationCode = {}));
export class MemoryStorageEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryStorageEngineError";
    }
}
//# sourceMappingURL=types.js.map