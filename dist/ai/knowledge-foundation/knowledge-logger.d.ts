import { KnowledgeFoundationLogEntry, KnowledgeFoundationLogLevel } from "./knowledge-log-types.js";
export declare class KnowledgeFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: KnowledgeFoundationLogLevel, event: KnowledgeFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<KnowledgeFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=knowledge-logger.d.ts.map