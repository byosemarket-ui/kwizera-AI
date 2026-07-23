import { MemoryIndexLogEntry, MemoryIndexLogLevel } from "./index-log-types.js";
export declare class MemoryIndexLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: MemoryIndexLogLevel, event: MemoryIndexLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=index-logger.d.ts.map