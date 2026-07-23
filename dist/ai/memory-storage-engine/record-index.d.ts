import { MemoryStorageIndex, MemoryStorageIndexEntry } from "./types.js";
import { MemoryStorageLogger } from "./storage-logger.js";
export declare class RecordIndex {
    private readonly logger;
    private indexPath;
    private index;
    constructor(logger: MemoryStorageLogger);
    initialize(storageDir: string): void;
    load(): void;
    persist(): void;
    getIndex(): MemoryStorageIndex;
    findById(memoryId: string): MemoryStorageIndexEntry | undefined;
    searchMetadata(query: string): MemoryStorageIndexEntry[];
    upsert(entry: MemoryStorageIndexEntry): void;
    getIndexPath(): string;
    getRecordCount(): number;
}
//# sourceMappingURL=record-index.d.ts.map