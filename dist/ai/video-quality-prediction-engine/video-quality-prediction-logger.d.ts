import { VideoQualityPredictionLogEntry, VideoQualityPredictionLogLevel } from "./video-quality-prediction-log-types.js";
export declare class VideoQualityPredictionLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoQualityPredictionLogLevel, event: VideoQualityPredictionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=video-quality-prediction-logger.d.ts.map