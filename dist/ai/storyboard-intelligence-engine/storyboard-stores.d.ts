import { StoryboardIntelligenceRecord } from "./types.js";
export declare class StoryboardRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: StoryboardIntelligenceRecord): void;
    get(storyboardId: string): StoryboardIntelligenceRecord | undefined;
    getByProduct(productId: string): StoryboardIntelligenceRecord[];
    getAll(): StoryboardIntelligenceRecord[];
    getCount(): number;
}
//# sourceMappingURL=storyboard-stores.d.ts.map