import { VideoQualityValidationLogEntry, VideoQualityValidationLogLevel } from "./video-quality-validation-log-types.js";
export declare class VideoQualityValidationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoQualityValidationLogLevel, event: VideoQualityValidationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-quality-validation-logger.d.ts.map