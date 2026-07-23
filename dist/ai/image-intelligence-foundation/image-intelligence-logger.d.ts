import { ImageIntelligenceFoundationLogEntry, ImageIntelligenceFoundationLogLevel } from "./image-intelligence-log-types.js";
export declare class ImageIntelligenceFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ImageIntelligenceFoundationLogLevel, event: ImageIntelligenceFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ImageIntelligenceFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-intelligence-logger.d.ts.map