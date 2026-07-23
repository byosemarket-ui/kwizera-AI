import { ImageRenderLogEntry, ImageRenderLogLevel } from "./image-render-log-types.js";
export declare class ImageRenderLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageRenderLogLevel, event: ImageRenderLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-render-logger.d.ts.map