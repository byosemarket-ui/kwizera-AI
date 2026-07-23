import { EnhancementPlanningLogEntry, EnhancementPlanningLogLevel } from "./enhancement-planning-log-types.js";
export declare class EnhancementPlanningLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: EnhancementPlanningLogLevel, event: EnhancementPlanningLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=enhancement-planning-logger.d.ts.map