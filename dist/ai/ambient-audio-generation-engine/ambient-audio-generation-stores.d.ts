import { AmbientAudioGenerationRecord } from "./types.js";
export declare class AmbientAudioGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AmbientAudioGenerationRecord): void;
    get(ambientPlanId: string): AmbientAudioGenerationRecord | undefined;
    getByProduct(productId: string): AmbientAudioGenerationRecord[];
    getByCategory(category: string): AmbientAudioGenerationRecord[];
    getAll(): AmbientAudioGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=ambient-audio-generation-stores.d.ts.map