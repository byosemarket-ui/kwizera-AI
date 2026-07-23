import { VideoGenerationHealthMonitorLogEntry, VideoGenerationHealthMonitorLogLevel } from "./health-log-types.js";
export declare class VideoGenerationHealthMonitorLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoGenerationHealthMonitorLogLevel, event: VideoGenerationHealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map