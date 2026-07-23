import { TaskManagerLogEntry, TaskManagerLogLevel } from "./task-log-types.js";
export declare class TaskManagerLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: TaskManagerLogLevel, event: TaskManagerLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<TaskManagerLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=task-logger.d.ts.map