import { AudienceLogEntry, AudienceLogLevel } from "./audience-log-types.js";
export declare class AudienceLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudienceLogLevel, event: AudienceLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audience-logger.d.ts.map