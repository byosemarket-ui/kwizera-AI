import { ImageGenerationHealthMonitorLogEntry, ImageGenerationHealthMonitorLogLevel } from "./health-log-types.js";
export declare class ImageGenerationHealthMonitorLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageGenerationHealthMonitorLogLevel, event: ImageGenerationHealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map