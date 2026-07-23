import { SoundEffectsGenerationRecord } from "./types.js";
export declare class SoundEffectsGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: SoundEffectsGenerationRecord): void;
    get(soundPlanId: string): SoundEffectsGenerationRecord | undefined;
    getByProduct(productId: string): SoundEffectsGenerationRecord[];
    getByCategory(category: string): SoundEffectsGenerationRecord[];
    getByProject(projectId: string): SoundEffectsGenerationRecord[];
    getAll(): SoundEffectsGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=sound-effects-generation-stores.d.ts.map