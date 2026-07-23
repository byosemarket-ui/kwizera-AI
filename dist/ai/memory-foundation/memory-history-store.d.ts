export interface MemoryHistoryRecord {
    timestamp: string;
    event: string;
    category?: string;
    operation?: string;
    requesterId?: string;
    durationMs?: number;
    success: boolean;
    detail?: string;
}
export declare class MemoryHistoryStore {
    private historyPath;
    private readonly records;
    initialize(memoryDirectory: string): void;
    append(record: MemoryHistoryRecord): void;
    getRecords(): ReadonlyArray<MemoryHistoryRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=memory-history-store.d.ts.map