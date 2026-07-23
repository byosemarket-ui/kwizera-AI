import { ImageProductionLogEntry, ImageProductionLogLevel } from "./image-production-log-types.js";
export declare class ImageProductionLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ImageProductionLogLevel, event: ImageProductionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=image-production-logger.d.ts.map