import { KnowledgeIntegrityCheckResult, KnowledgeRecord } from "./types.js";
import { KnowledgeRecordValidator } from "./knowledge-record-validator.js";
import { KnowledgeRecordIndex } from "./knowledge-record-index.js";
import { KnowledgeRecordStore } from "./knowledge-record-store.js";
import { KnowledgeVersionManager } from "./knowledge-version-manager.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";
export declare class KnowledgeIntegrityChecker {
    private readonly logger;
    private readonly validator;
    private readonly store;
    private readonly index;
    private readonly versionManager;
    constructor(logger: KnowledgeStorageLogger, validator: KnowledgeRecordValidator, store: KnowledgeRecordStore, index: KnowledgeRecordIndex, versionManager: KnowledgeVersionManager);
    runFullCheck(): KnowledgeIntegrityCheckResult;
    verifySingleRecord(record: KnowledgeRecord): boolean;
}
//# sourceMappingURL=knowledge-integrity-checker.d.ts.map