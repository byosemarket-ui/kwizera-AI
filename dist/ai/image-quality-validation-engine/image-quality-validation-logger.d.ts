import { ImageQualityValidationLogEntry, ImageQualityValidationLogLevel } from "./image-quality-validation-log-types.js";
export declare class ImageQualityValidationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageQualityValidationLogLevel, event: ImageQualityValidationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-quality-validation-logger.d.ts.map