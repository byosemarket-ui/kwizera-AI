import { ImageToImageGenerationLogEntry, ImageToImageGenerationLogLevel } from "./image-to-image-generation-log-types.js";
export declare class ImageToImageGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageToImageGenerationLogLevel, event: ImageToImageGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-to-image-generation-logger.d.ts.map