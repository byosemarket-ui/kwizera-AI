import { VisualPlanningRecord } from "./types.js";
export declare class VisualPlanningRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VisualPlanningRecord): void;
    get(visualPlanId: string): VisualPlanningRecord | undefined;
    getByProduct(productId: string): VisualPlanningRecord[];
    getAll(): VisualPlanningRecord[];
    getCount(): number;
}
//# sourceMappingURL=visual-planning-stores.d.ts.map