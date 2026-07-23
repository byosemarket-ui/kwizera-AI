import { WorkflowHistoryRecord } from "./types.js";
export declare class WorkflowHistoryStore {
    private historyPath;
    private readonly records;
    initialize(workflowsDirectory: string): void;
    append(record: WorkflowHistoryRecord): void;
    getAll(): ReadonlyArray<WorkflowHistoryRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=workflow-history-store.d.ts.map