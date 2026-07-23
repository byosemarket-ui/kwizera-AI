import { MarketingStrategyLogEntry, MarketingStrategyLogLevel } from "./marketing-strategy-log-types.js";
export declare class MarketingStrategyLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MarketingStrategyLogLevel, event: MarketingStrategyLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=marketing-strategy-logger.d.ts.map