import { MemoryStorageLogEntry, MemoryStorageLogLevel } from "./storage-log-types.js";
export declare class MemoryStorageLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: MemoryStorageLogLevel, event: MemoryStorageLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<MemoryStorageLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=storage-logger.d.ts.map