import { ImageGenerationOptimizationRecord } from "./types.js";
export declare class ImageGenerationOptimizationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageGenerationOptimizationRecord): void;
    get(optimizationId: string): ImageGenerationOptimizationRecord | undefined;
    getByProduct(productId: string): ImageGenerationOptimizationRecord[];
    getByValidation(validationId: string): ImageGenerationOptimizationRecord[];
    getAll(): ImageGenerationOptimizationRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-generation-optimization-stores.d.ts.map