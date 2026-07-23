import { HealthMonitorLogEntry, HealthMonitorLogLevel } from "./health-log-types.js";
export declare class MemoryHealthMonitorLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: HealthMonitorLogLevel, event: HealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map