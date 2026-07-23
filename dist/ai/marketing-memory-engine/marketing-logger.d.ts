import { MarketingMemoryLogEntry, MarketingMemoryLogLevel } from "./marketing-log-types.js";
export declare class MarketingMemoryLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MarketingMemoryLogLevel, event: MarketingMemoryLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=marketing-logger.d.ts.map