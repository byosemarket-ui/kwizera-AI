export interface VideoGenerationHistoryRecord {
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
export declare class VideoGenerationHistoryStore {
    private historyPath;
    private readonly records;
    initialize(generationDirectory: string): void;
    append(record: VideoGenerationHistoryRecord): void;
    getRecords(): ReadonlyArray<VideoGenerationHistoryRecord>;
    getCount(): number;
}
//# sourceMappingURL=video-generation-history-store.d.ts.map