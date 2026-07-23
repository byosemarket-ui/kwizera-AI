import { VideoIntelligenceOptimizationLogEntry, VideoIntelligenceOptimizationLogLevel } from "./video-intelligence-optimization-log-types.js";
export declare class VideoIntelligenceOptimizationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VideoIntelligenceOptimizationLogLevel, event: VideoIntelligenceOptimizationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=video-intelligence-optimization-logger.d.ts.map