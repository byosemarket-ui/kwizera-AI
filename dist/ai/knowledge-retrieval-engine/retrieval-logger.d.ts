import { KnowledgeRetrievalLogEntry, KnowledgeRetrievalLogLevel } from "./retrieval-log-types.js";
export declare class KnowledgeRetrievalLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: KnowledgeRetrievalLogLevel, event: KnowledgeRetrievalLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<KnowledgeRetrievalLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=retrieval-logger.d.ts.map