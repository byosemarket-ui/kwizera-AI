import { TaskHistoryRecord } from "./types.js";
export declare class TaskHistoryStore {
    private historyPath;
    private readonly records;
    initialize(tasksDirectory: string): void;
    append(record: TaskHistoryRecord): void;
    getAll(): ReadonlyArray<TaskHistoryRecord>;
    getCount(): number;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=task-history-store.d.ts.map