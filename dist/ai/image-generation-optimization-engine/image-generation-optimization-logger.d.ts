import { ImageGenerationOptimizationLogEntry, ImageGenerationOptimizationLogLevel } from "./image-generation-optimization-log-types.js";
export declare class ImageGenerationOptimizationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageGenerationOptimizationLogLevel, event: ImageGenerationOptimizationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-generation-optimization-logger.d.ts.map