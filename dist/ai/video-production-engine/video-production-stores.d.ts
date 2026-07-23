import { VideoProductionRecord } from "./types.js";
export declare class VideoProductionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VideoProductionRecord): void;
    get(productionId: string): VideoProductionRecord | undefined;
    getByStoryboard(storyboardId: string): VideoProductionRecord[];
    getAll(): VideoProductionRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-production-stores.d.ts.map