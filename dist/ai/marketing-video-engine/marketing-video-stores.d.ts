import { MarketingVideoRecord } from "./types.js";
export declare class MarketingVideoRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: MarketingVideoRecord): void;
    get(marketingVideoId: string): MarketingVideoRecord | undefined;
    getByStoryboard(storyboardId: string): MarketingVideoRecord[];
    getAll(): MarketingVideoRecord[];
    getCount(): number;
}
//# sourceMappingURL=marketing-video-stores.d.ts.map