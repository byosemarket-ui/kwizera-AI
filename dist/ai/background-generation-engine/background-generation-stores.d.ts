import { BackgroundGenerationRecord } from "./types.js";
export declare class BackgroundGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: BackgroundGenerationRecord): void;
    get(backgroundPlanId: string): BackgroundGenerationRecord | undefined;
    getBySourceImage(sourceImageId: string): BackgroundGenerationRecord[];
    getByProduct(productId: string): BackgroundGenerationRecord[];
    getAll(): BackgroundGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=background-generation-stores.d.ts.map