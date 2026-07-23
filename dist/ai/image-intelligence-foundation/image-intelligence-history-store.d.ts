export interface ImageIntelligenceHistoryRecord {
    timestamp: string;
    event: string;
    category?: string;
    operation?: string;
    requesterId?: string;
    durationMs?: number;
    success: boolean;
    detail?: string;
}
export declare class ImageIntelligenceHistoryStore {
    private historyPath;
    private readonly records;
    initialize(intelligenceDirectory: string): void;
    append(record: ImageIntelligenceHistoryRecord): void;
    getRecords(): ReadonlyArray<ImageIntelligenceHistoryRecord>;
    getCount(): number;
}
//# sourceMappingURL=image-intelligence-history-store.d.ts.map