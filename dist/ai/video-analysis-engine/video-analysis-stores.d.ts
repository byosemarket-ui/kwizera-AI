import { VideoAnalysisIntelligenceRecord } from "./types.js";
export declare class VideoAnalysisRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VideoAnalysisIntelligenceRecord): void;
    get(videoId: string): VideoAnalysisIntelligenceRecord | undefined;
    getAll(): VideoAnalysisIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=video-analysis-stores.d.ts.map