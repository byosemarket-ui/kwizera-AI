import { MarketingVideoLogEntry, MarketingVideoLogLevel } from "./marketing-video-log-types.js";
export declare class MarketingVideoLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MarketingVideoLogLevel, event: MarketingVideoLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=marketing-video-logger.d.ts.map