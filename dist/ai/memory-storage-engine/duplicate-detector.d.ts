import { MemoryStorageIndex, MemoryStorageIndexEntry } from "./types.js";
import { RecordValidator } from "./record-validator.js";
import { MemoryStorageLogger } from "./storage-logger.js";
export declare class DuplicateDetector {
    private readonly logger;
    private readonly validator;
    constructor(logger: MemoryStorageLogger, validator: RecordValidator);
    checkDuplicate(index: MemoryStorageIndex, entry: {
        memoryId: string;
        memoryType: string;
        title: string;
        source: string;
        contentHash: string;
    }, allowSameIdUpdate?: boolean): {
        isDuplicate: boolean;
        reason?: string;
    };
    buildIndexEntry(record: {
        memoryId: string;
        memoryType: import("./types.js").MemoryStorageType;
        title: string;
        category: string;
        source: string;
        contentHash: string;
        version: number;
        storageLocation: string;
        lastUpdate: string;
        searchableText: string;
    }): MemoryStorageIndexEntry;
}
//# sourceMappingURL=duplicate-detector.d.ts.map