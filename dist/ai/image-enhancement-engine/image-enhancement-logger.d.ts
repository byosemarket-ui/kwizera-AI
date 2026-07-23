import { ImageEnhancementLogEntry, ImageEnhancementLogLevel } from "./image-enhancement-log-types.js";
export declare class ImageEnhancementLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageEnhancementLogLevel, event: ImageEnhancementLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-enhancement-logger.d.ts.map