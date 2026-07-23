import { ImageToImageGenerationRecord } from "./types.js";
export declare class ImageToImageGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageToImageGenerationRecord): void;
    get(transformationPlanId: string): ImageToImageGenerationRecord | undefined;
    getBySourceImage(sourceImageId: string): ImageToImageGenerationRecord[];
    getByProduct(productId: string): ImageToImageGenerationRecord[];
    getByProject(projectId: string): ImageToImageGenerationRecord[];
    getAll(): ImageToImageGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-to-image-generation-stores.d.ts.map