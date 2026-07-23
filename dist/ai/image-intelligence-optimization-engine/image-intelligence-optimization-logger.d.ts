import { ImageIntelligenceOptimizationLogEntry, ImageIntelligenceOptimizationLogLevel } from "./image-intelligence-optimization-log-types.js";
export declare class ImageIntelligenceOptimizationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageIntelligenceOptimizationLogLevel, event: ImageIntelligenceOptimizationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-intelligence-optimization-logger.d.ts.map