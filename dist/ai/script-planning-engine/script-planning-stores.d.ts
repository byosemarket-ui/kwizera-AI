import { ScriptPlanningRecord } from "./types.js";
export declare class ScriptPlanningRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ScriptPlanningRecord): void;
    get(scriptPlanId: string): ScriptPlanningRecord | undefined;
    getByProduct(productId: string): ScriptPlanningRecord[];
    getAll(): ScriptPlanningRecord[];
    getCount(): number;
}
//# sourceMappingURL=script-planning-stores.d.ts.map