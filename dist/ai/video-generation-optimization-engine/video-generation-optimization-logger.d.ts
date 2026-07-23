import { VideoGenerationOptimizationLogEntry, VideoGenerationOptimizationLogLevel } from "./video-generation-optimization-log-types.js";
export declare class VideoGenerationOptimizationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoGenerationOptimizationLogLevel, event: VideoGenerationOptimizationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-generation-optimization-logger.d.ts.map