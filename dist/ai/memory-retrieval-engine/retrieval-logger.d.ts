import { MemoryRetrievalLogEntry, MemoryRetrievalLogLevel } from "./retrieval-log-types.js";
export declare class MemoryRetrievalLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: MemoryRetrievalLogLevel, event: MemoryRetrievalLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<MemoryRetrievalLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=retrieval-logger.d.ts.map