import { KnowledgeHealthMonitorLogEntry, KnowledgeHealthMonitorLogLevel } from "./health-log-types.js";
export declare class KnowledgeHealthMonitorLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: KnowledgeHealthMonitorLogLevel, event: KnowledgeHealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map