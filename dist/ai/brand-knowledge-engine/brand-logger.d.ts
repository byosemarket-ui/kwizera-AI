import { BrandKnowledgeLogEntry, BrandKnowledgeLogLevel } from "./brand-log-types.js";
export declare class BrandKnowledgeLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: BrandKnowledgeLogLevel, event: BrandKnowledgeLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=brand-logger.d.ts.map