import { VideoIntelligenceHealthMonitorLogEntry, VideoIntelligenceHealthMonitorLogLevel } from "./health-log-types.js";
export declare class VideoIntelligenceHealthMonitorLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoIntelligenceHealthMonitorLogLevel, event: VideoIntelligenceHealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map