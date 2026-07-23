import { ImageEditingLogEntry, ImageEditingLogLevel } from "./image-editing-log-types.js";
export declare class ImageEditingLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageEditingLogLevel, event: ImageEditingLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-editing-logger.d.ts.map