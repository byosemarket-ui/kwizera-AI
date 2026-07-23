import { ProductionPlanningRecord } from "./types.js";
export declare class ProductionPlanningRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ProductionPlanningRecord): void;
    get(productionPlanId: string): ProductionPlanningRecord | undefined;
    getByProduct(productId: string): ProductionPlanningRecord[];
    getAll(): ProductionPlanningRecord[];
    getCount(): number;
}
//# sourceMappingURL=production-planning-stores.d.ts.map