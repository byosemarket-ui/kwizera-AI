import { ImageQualityPredictionLogEntry, ImageQualityPredictionLogLevel } from "./image-quality-prediction-log-types.js";
export declare class ImageQualityPredictionLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ImageQualityPredictionLogLevel, event: ImageQualityPredictionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-quality-prediction-logger.d.ts.map