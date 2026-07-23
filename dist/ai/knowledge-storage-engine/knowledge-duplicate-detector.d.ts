import { KnowledgeStorageIndex, KnowledgeStorageIndexEntry } from "./types.js";
import { KnowledgeRecordValidator } from "./knowledge-record-validator.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";
import { KnowledgeStorageType } from "./types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
export declare class KnowledgeDuplicateDetector {
    private readonly logger;
    private readonly validator;
    constructor(logger: KnowledgeStorageLogger, validator: KnowledgeRecordValidator);
    checkDuplicate(index: KnowledgeStorageIndex, entry: {
        knowledgeId: string;
        knowledgeType: string;
        title: string;
        source: string;
        contentHash: string;
    }, allowSameIdUpdate?: boolean): {
        isDuplicate: boolean;
        reason?: string;
    };
    private buildSemanticKey;
    buildIndexEntry(record: {
        knowledgeId: string;
        knowledgeType: KnowledgeStorageType;
        title: string;
        category: string;
        source: string;
        contentHash: string;
        version: number;
        storageLocation: string;
        lastUpdated: string;
        searchableText: string;
        classification: {
            topic: string;
            importance: string;
        };
        verificationStatus: KnowledgeVerificationStatus;
    }): KnowledgeStorageIndexEntry;
}
//# sourceMappingURL=knowledge-duplicate-detector.d.ts.map