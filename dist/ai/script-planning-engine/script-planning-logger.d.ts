import { ScriptPlanningLogEntry, ScriptPlanningLogLevel } from "./script-planning-log-types.js";
export declare class ScriptPlanningLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ScriptPlanningLogLevel, event: ScriptPlanningLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=script-planning-logger.d.ts.map