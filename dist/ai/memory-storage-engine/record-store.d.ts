import { MemoryStorageLogger } from "./storage-logger.js";
export declare class RecordStore {
    private readonly logger;
    private recordsRoot;
    private storageDir;
    constructor(logger: MemoryStorageLogger);
    initialize(memoryRoot: string): void;
    getRecordsRoot(): string;
    getStorageDir(): string;
    getRecordPath(memoryType: string, memoryId: string): string;
    isStorageAvailable(): boolean;
    writeRecord(recordPath: string, record: unknown): number;
    readRecord<T>(recordPath: string): {
        data: T | null;
        durationMs: number;
    };
    verifyRecordChecksum(recordPath: string): boolean;
}
//# sourceMappingURL=record-store.d.ts.map