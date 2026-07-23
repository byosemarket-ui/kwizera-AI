import { ProductionImagePlanningRecord } from "./types.js";
export declare class ProductionImagePlanningRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ProductionImagePlanningRecord): void;
    get(imageId: string): ProductionImagePlanningRecord | undefined;
    getAll(): ProductionImagePlanningRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=production-planning-stores.d.ts.map