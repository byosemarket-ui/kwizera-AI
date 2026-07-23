import { IndexType, InvertedIndexData } from "./types.js";
import { MemoryIndexLogger } from "./index-logger.js";
export declare class InvertedIndexStore {
    private readonly logger;
    private indexesDir;
    private caches;
    constructor(logger: MemoryIndexLogger);
    initialize(indexesDir: string): void;
    private filePath;
    loadOrCreate(type: IndexType): InvertedIndexData;
    addEntry(type: IndexType, key: string, memoryId: string): void;
    removeEntry(type: IndexType, memoryId: string): void;
    lookup(type: IndexType, key: string): string[];
    lookupAll(type: IndexType): Record<string, string[]>;
    getIndex(type: IndexType): InvertedIndexData;
    clearType(type: IndexType): void;
    clearAll(): void;
    persist(type: IndexType): void;
    verifyChecksum(type: IndexType): boolean;
    getIndexesDir(): string;
}
//# sourceMappingURL=inverted-index-store.d.ts.map