import { ImageEnhancementRecord } from "./types.js";
export declare class ImageEnhancementRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageEnhancementRecord): void;
    get(enhancementPlanId: string): ImageEnhancementRecord | undefined;
    getBySourceImage(sourceImageId: string): ImageEnhancementRecord[];
    getByProduct(productId: string): ImageEnhancementRecord[];
    getAll(): ImageEnhancementRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-enhancement-stores.d.ts.map