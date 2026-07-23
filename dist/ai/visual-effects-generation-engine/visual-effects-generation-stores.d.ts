import { VisualEffectsGenerationRecord } from "./types.js";
export declare class VisualEffectsGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VisualEffectsGenerationRecord): void;
    get(visualEffectPlanId: string): VisualEffectsGenerationRecord | undefined;
    getByScene(sceneId: string): VisualEffectsGenerationRecord[];
    getByStoryboard(storyboardId: string): VisualEffectsGenerationRecord[];
    getAll(): VisualEffectsGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=visual-effects-generation-stores.d.ts.map