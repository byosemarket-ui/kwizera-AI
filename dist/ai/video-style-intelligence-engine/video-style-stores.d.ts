import { VideoStyleIntelligenceRecord } from "./types.js";
export declare class VideoStyleRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VideoStyleIntelligenceRecord): void;
    get(videoId: string): VideoStyleIntelligenceRecord | undefined;
    getAll(): VideoStyleIntelligenceRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-style-stores.d.ts.map