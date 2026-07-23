import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import type { AiKnowledgeStorageEngine } from "../knowledge-storage-engine/knowledge-storage-engine.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";
export interface KnowledgeRetrievalValidationResult {
    valid: boolean;
    diagnostics: string[];
    recoverySuggestion?: string;
}
export declare class KnowledgeRetrievalValidator {
    private readonly logger;
    private readonly storageEngine;
    constructor(logger: KnowledgeRetrievalLogger, storageEngine: AiKnowledgeStorageEngine);
    validateForRetrieval(knowledgeId: string, requesterId: string): Promise<KnowledgeRetrievalValidationResult>;
    validateRecord(record: KnowledgeRecord): KnowledgeRetrievalValidationResult;
}
export declare function isKnowledgeRetrievable(record: KnowledgeRecord): boolean;
//# sourceMappingURL=retrieval-validator.d.ts.map