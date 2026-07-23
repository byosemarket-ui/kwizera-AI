import { BackgroundGenerationLogEntry, BackgroundGenerationLogLevel } from "./background-generation-log-types.js";
export declare class BackgroundGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: BackgroundGenerationLogLevel, event: BackgroundGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=background-generation-logger.d.ts.map