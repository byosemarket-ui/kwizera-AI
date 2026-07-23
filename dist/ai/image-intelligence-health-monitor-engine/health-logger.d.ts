import { ImageIntelligenceHealthMonitorLogEntry, ImageIntelligenceHealthMonitorLogLevel } from "./health-log-types.js";
export declare class ImageIntelligenceHealthMonitorLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageIntelligenceHealthMonitorLogLevel, event: ImageIntelligenceHealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map