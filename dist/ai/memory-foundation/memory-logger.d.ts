import { MemoryFoundationLogEntry, MemoryFoundationLogLevel } from "./memory-log-types.js";
export declare class MemoryFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: MemoryFoundationLogLevel, event: MemoryFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<MemoryFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=memory-logger.d.ts.map