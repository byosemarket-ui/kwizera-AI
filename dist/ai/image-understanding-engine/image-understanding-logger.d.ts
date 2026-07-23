import { ImageUnderstandingLogEntry, ImageUnderstandingLogLevel } from "./image-understanding-log-types.js";
export declare class ImageUnderstandingLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ImageUnderstandingLogLevel, event: ImageUnderstandingLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ImageUnderstandingLogEntry>;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-understanding-logger.d.ts.map