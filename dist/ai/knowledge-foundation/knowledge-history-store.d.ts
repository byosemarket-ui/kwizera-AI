export interface KnowledgeHistoryRecord {
    timestamp: string;
    event: string;
    category?: string;
    operation?: string;
    requesterId?: string;
    durationMs?: number;
    success: boolean;
    detail?: string;
}
export declare class KnowledgeHistoryStore {
    private historyPath;
    private readonly records;
    initialize(knowledgeDirectory: string): void;
    append(record: KnowledgeHistoryRecord): void;
    getRecords(): ReadonlyArray<KnowledgeHistoryRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=knowledge-history-store.d.ts.map