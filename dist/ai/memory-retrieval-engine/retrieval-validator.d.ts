import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { AiMemoryStorageEngine } from "../memory-storage-engine/memory-storage-engine.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";
export interface RetrievalValidationResult {
    valid: boolean;
    diagnostics: string[];
    recoverySuggestion?: string;
}
export declare class RetrievalValidator {
    private readonly logger;
    private readonly storageEngine;
    constructor(logger: MemoryRetrievalLogger, storageEngine: AiMemoryStorageEngine);
    validateForRetrieval(memoryId: string, requesterId: string): Promise<RetrievalValidationResult>;
    validateRecord(record: MemoryRecord): RetrievalValidationResult;
}
//# sourceMappingURL=retrieval-validator.d.ts.map