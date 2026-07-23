import { MarketingKnowledgeLogEntry, MarketingKnowledgeLogLevel } from "./marketing-log-types.js";
export declare class MarketingKnowledgeLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MarketingKnowledgeLogLevel, event: MarketingKnowledgeLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=marketing-logger.d.ts.map