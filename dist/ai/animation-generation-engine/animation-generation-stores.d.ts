import { AnimationGenerationRecord } from "./types.js";
export declare class AnimationGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AnimationGenerationRecord): void;
    get(animationPlanId: string): AnimationGenerationRecord | undefined;
    getByScene(sceneId: string): AnimationGenerationRecord[];
    getByStoryboard(storyboardId: string): AnimationGenerationRecord[];
    getAll(): AnimationGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=animation-generation-stores.d.ts.map