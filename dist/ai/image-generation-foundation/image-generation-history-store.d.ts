export interface ImageGenerationHistoryRecord {
    timestamp: string;
    event: string;
    category?: string;
    operation?: string;
    requesterId?: string;
    projectId?: string;
    durationMs?: number;
    success: boolean;
    detail?: string;
}
export declare class ImageGenerationHistoryStore {
    private historyPath;
    private readonly records;
    initialize(generationDirectory: string): void;
    append(record: ImageGenerationHistoryRecord): void;
    getRecords(): ReadonlyArray<ImageGenerationHistoryRecord>;
    getCount(): number;
}
//# sourceMappingURL=image-generation-history-store.d.ts.map