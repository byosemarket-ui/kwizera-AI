import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import type { KnowledgeStorageIndexEntry } from "../knowledge-storage-engine/types.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";
export declare class KnowledgeRetrievalCache {
    private readonly logger;
    private cache;
    private hits;
    private misses;
    constructor(logger: KnowledgeRetrievalLogger);
    get(knowledgeId: string, indexEntry?: KnowledgeStorageIndexEntry): KnowledgeRecord | null;
    set(knowledgeId: string, record: KnowledgeRecord, indexEntry?: KnowledgeStorageIndexEntry): void;
    invalidate(knowledgeId: string): void;
    clear(): void;
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRate: number;
    };
}
//# sourceMappingURL=retrieval-cache.d.ts.map