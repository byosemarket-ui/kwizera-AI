import { AudioQualityValidationRecord } from "./types.js";
export declare class AudioQualityValidationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudioQualityValidationRecord): void;
    get(audioQualityValidationId: string): AudioQualityValidationRecord | undefined;
    getByProduct(productId: string): AudioQualityValidationRecord[];
    getByRenderPlan(renderPlanId: string): AudioQualityValidationRecord[];
    getAll(): AudioQualityValidationRecord[];
    getCount(): number;
}
//# sourceMappingURL=audio-quality-validation-stores.d.ts.map