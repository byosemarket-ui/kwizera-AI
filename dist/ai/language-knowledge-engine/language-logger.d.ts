import { LanguageKnowledgeLogEntry, LanguageKnowledgeLogLevel } from "./language-log-types.js";
export declare class LanguageKnowledgeLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: LanguageKnowledgeLogLevel, event: LanguageKnowledgeLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=language-logger.d.ts.map