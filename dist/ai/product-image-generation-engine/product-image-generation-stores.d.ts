import { ProductImageGenerationRecord } from "./types.js";
export declare class ProductImageGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ProductImageGenerationRecord): void;
    get(productImagePlanId: string): ProductImageGenerationRecord | undefined;
    getByProduct(productId: string): ProductImageGenerationRecord[];
    getByProject(projectId: string): ProductImageGenerationRecord[];
    getByCategory(productCategory: string): ProductImageGenerationRecord[];
    getAll(): ProductImageGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=product-image-generation-stores.d.ts.map