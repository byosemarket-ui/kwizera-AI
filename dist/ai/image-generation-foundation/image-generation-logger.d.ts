import { ImageGenerationFoundationLogEntry, ImageGenerationFoundationLogLevel } from "./image-generation-log-types.js";
export declare class ImageGenerationFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ImageGenerationFoundationLogLevel, event: ImageGenerationFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ImageGenerationFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-generation-logger.d.ts.map