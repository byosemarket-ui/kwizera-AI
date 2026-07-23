import { KnowledgeStorageIndex, KnowledgeStorageIndexEntry } from "./types.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";
export declare class KnowledgeRecordIndex {
    private readonly logger;
    private indexPath;
    private index;
    constructor(logger: KnowledgeStorageLogger);
    initialize(storageDir: string): void;
    load(): void;
    persist(): void;
    getIndex(): KnowledgeStorageIndex;
    findById(knowledgeId: string): KnowledgeStorageIndexEntry | undefined;
    searchMetadata(query: string): KnowledgeStorageIndexEntry[];
    findByCategory(category: string): KnowledgeStorageIndexEntry[];
    findByTopic(topic: string): KnowledgeStorageIndexEntry[];
    upsert(entry: KnowledgeStorageIndexEntry): void;
    getIndexPath(): string;
    getRecordCount(): number;
}
//# sourceMappingURL=knowledge-record-index.d.ts.map