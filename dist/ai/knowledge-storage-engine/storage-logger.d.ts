import { KnowledgeStorageLogEntry, KnowledgeStorageLogLevel } from "./storage-log-types.js";
export declare class KnowledgeStorageLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: KnowledgeStorageLogLevel, event: KnowledgeStorageLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<KnowledgeStorageLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=storage-logger.d.ts.map