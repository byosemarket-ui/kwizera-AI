import { VisualPlanningLogEntry, VisualPlanningLogLevel } from "./visual-planning-log-types.js";
export declare class VisualPlanningLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VisualPlanningLogLevel, event: VisualPlanningLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=visual-planning-logger.d.ts.map