import { KnowledgeStorageLogger } from "./storage-logger.js";
export declare class KnowledgeRecordStore {
    private readonly logger;
    private recordsRoot;
    private storageDir;
    constructor(logger: KnowledgeStorageLogger);
    initialize(knowledgeRoot: string): void;
    getRecordsRoot(): string;
    getStorageDir(): string;
    getRecordPath(knowledgeType: string, knowledgeId: string): string;
    isStorageAvailable(): boolean;
    writeRecord(recordPath: string, record: unknown): number;
    readRecord<T>(recordPath: string): {
        data: T | null;
        durationMs: number;
    };
    verifyRecordChecksum(recordPath: string): boolean;
}
//# sourceMappingURL=knowledge-record-store.d.ts.map