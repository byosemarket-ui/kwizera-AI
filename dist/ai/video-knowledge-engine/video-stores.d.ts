import { VideoAnalysisRecord, VideoLearningPattern } from "./types.js";
export declare class VideoPatternStore {
    private storePath;
    private patterns;
    initialize(videoDir: string): void;
    add(pattern: VideoLearningPattern): void;
    getAll(): VideoLearningPattern[];
    getCount(): number;
}
export declare class VideoRecordStore {
    private storePath;
    private records;
    initialize(videoDir: string): void;
    upsert(record: VideoAnalysisRecord): void;
    get(videoId: string): VideoAnalysisRecord | undefined;
    getAll(): VideoAnalysisRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-stores.d.ts.map