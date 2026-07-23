import { ImageQualityValidationRecord } from "./types.js";
export declare class ImageQualityValidationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageQualityValidationRecord): void;
    get(qualityValidationId: string): ImageQualityValidationRecord | undefined;
    getByProduct(productId: string): ImageQualityValidationRecord[];
    getByRenderPlan(renderPlanId: string): ImageQualityValidationRecord[];
    getAll(): ImageQualityValidationRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-quality-validation-stores.d.ts.map