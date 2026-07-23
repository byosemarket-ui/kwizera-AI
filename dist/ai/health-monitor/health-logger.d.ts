import { HealthMonitorLogEntry, HealthMonitorLogLevel } from "./health-log-types.js";
export declare class HealthMonitorLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: HealthMonitorLogLevel, event: HealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<HealthMonitorLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map