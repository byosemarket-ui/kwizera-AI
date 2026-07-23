import { PlanningLogEntry, PlanningLogLevel } from "./planning-log-types.js";
export declare class PlanningLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: PlanningLogLevel, event: PlanningLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<PlanningLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=planning-logger.d.ts.map