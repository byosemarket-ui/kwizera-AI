export interface VideoIntelligenceHistoryRecord {
    timestamp: string;
    event: string;
    category?: string;
    operation?: string;
    requesterId?: string;
    projectId?: string;
    videoId?: string;
    durationMs?: number;
    success: boolean;
    detail?: string;
}
export declare class VideoIntelligenceHistoryStore {
    private historyPath;
    private readonly records;
    initialize(intelligenceDirectory: string): void;
    append(record: VideoIntelligenceHistoryRecord): void;
    getRecords(): ReadonlyArray<VideoIntelligenceHistoryRecord>;
    getCount(): number;
}
//# sourceMappingURL=video-intelligence-history-store.d.ts.map