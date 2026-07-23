import { ImageRenderRecord } from "./types.js";
export declare class ImageRenderRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageRenderRecord): void;
    get(imageRenderPlanId: string): ImageRenderRecord | undefined;
    getByProduction(productionId: string): ImageRenderRecord[];
    getByProduct(productId: string): ImageRenderRecord[];
    getAll(): ImageRenderRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-render-stores.d.ts.map