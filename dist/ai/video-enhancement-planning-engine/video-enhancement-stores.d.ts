import { VideoEnhancementPlanRecord } from "./types.js";
export declare class VideoEnhancementRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VideoEnhancementPlanRecord): void;
    get(videoId: string): VideoEnhancementPlanRecord | undefined;
    getAll(): VideoEnhancementPlanRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-enhancement-stores.d.ts.map