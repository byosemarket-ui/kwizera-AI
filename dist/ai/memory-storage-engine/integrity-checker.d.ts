import { IntegrityCheckResult, MemoryRecord } from "./types.js";
import { RecordValidator } from "./record-validator.js";
import { RecordIndex } from "./record-index.js";
import { RecordStore } from "./record-store.js";
import { MemoryStorageLogger } from "./storage-logger.js";
export declare class IntegrityChecker {
    private readonly logger;
    private readonly validator;
    private readonly store;
    private readonly index;
    constructor(logger: MemoryStorageLogger, validator: RecordValidator, store: RecordStore, index: RecordIndex);
    runFullCheck(): IntegrityCheckResult;
    verifySingleRecord(record: MemoryRecord): boolean;
}
//# sourceMappingURL=integrity-checker.d.ts.map