import { StoryboardGenerationRecord } from "./types.js";
export declare class StoryGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: StoryboardGenerationRecord): void;
    get(storyboardId: string): StoryboardGenerationRecord | undefined;
    getByProduct(productId: string): StoryboardGenerationRecord[];
    getByProject(projectId: string): StoryboardGenerationRecord[];
    getByCampaign(campaignId: string): StoryboardGenerationRecord[];
    getAll(): StoryboardGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=story-generation-stores.d.ts.map