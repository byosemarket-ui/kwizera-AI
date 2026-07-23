import { PlanningRecord } from "./types.js";
export declare class PlanningHistoryStore {
    private historyPath;
    private readonly records;
    initialize(plansDirectory: string): void;
    append(record: PlanningRecord): void;
    getAll(): ReadonlyArray<PlanningRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=planning-history-store.d.ts.map