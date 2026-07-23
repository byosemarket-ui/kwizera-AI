import { WorkflowLogEntry, WorkflowLogLevel } from "./workflow-log-types.js";
export declare class WorkflowLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: WorkflowLogLevel, event: WorkflowLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<WorkflowLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=workflow-logger.d.ts.map