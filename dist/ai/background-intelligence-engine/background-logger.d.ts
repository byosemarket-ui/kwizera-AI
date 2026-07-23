import { BackgroundLogEntry, BackgroundLogLevel } from "./background-log-types.js";
export declare class BackgroundLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: BackgroundLogLevel, event: BackgroundLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=background-logger.d.ts.map