import { AudioEnhancementGenerationRecord } from "./types.js";
export declare class AudioEnhancementRestorationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudioEnhancementGenerationRecord): void;
    get(enhancementPlanId: string): AudioEnhancementGenerationRecord | undefined;
    getByProduct(productId: string): AudioEnhancementGenerationRecord[];
    getByType(enhancementType: string): AudioEnhancementGenerationRecord[];
    getAll(): AudioEnhancementGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=audio-enhancement-restoration-stores.d.ts.map