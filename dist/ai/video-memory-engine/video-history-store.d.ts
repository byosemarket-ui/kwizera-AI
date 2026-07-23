export interface VideoHistoryEvent {
    timestamp: string;
    event: "create" | "update" | "complete" | "export" | "pattern" | "learn";
    videoId: string;
    projectId: string;
    detail: string;
    version?: number;
}
export declare class VideoHistoryStore {
    private historyPath;
    private readonly events;
    initialize(videoDir: string): void;
    append(event: VideoHistoryEvent): void;
    getAll(): ReadonlyArray<VideoHistoryEvent>;
    getByVideo(videoId: string): VideoHistoryEvent[];
    getByProject(projectId: string): VideoHistoryEvent[];
    getCount(): number;
}
//# sourceMappingURL=video-history-store.d.ts.map