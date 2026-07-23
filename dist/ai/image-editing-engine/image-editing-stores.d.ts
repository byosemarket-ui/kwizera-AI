import { ImageEditingRecord } from "./types.js";
export declare class ImageEditingRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageEditingRecord): void;
    get(imageEditingPlanId: string): ImageEditingRecord | undefined;
    getBySourceImage(sourceImageId: string): ImageEditingRecord[];
    getByProduct(productId: string): ImageEditingRecord[];
    getAll(): ImageEditingRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-editing-stores.d.ts.map