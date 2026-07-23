import { ImageAnalysisLogEntry, ImageAnalysisLogLevel } from "./image-analysis-log-types.js";
export declare class ImageAnalysisLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ImageAnalysisLogLevel, event: ImageAnalysisLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ImageAnalysisLogEntry>;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-analysis-logger.d.ts.map