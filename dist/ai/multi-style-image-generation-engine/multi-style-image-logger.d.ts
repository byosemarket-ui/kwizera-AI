import { MultiStyleImageLogEntry, MultiStyleImageLogLevel } from "./multi-style-image-log-types.js";
export declare class MultiStyleImageLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MultiStyleImageLogLevel, event: MultiStyleImageLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=multi-style-image-logger.d.ts.map