import { ImageProductionRecord } from "./types.js";
export declare class ImageProductionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageProductionRecord): void;
    get(imageProductionId: string): ImageProductionRecord | undefined;
    getByProduct(productId: string): ImageProductionRecord[];
    getByImagePlan(imagePlanId: string): ImageProductionRecord[];
    getAll(): ImageProductionRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-production-stores.d.ts.map