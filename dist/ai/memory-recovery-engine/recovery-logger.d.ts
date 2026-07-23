import { MemoryRecoveryLogEntry, MemoryRecoveryLogLevel } from "./recovery-log-types.js";
export declare class MemoryRecoveryLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MemoryRecoveryLogLevel, event: MemoryRecoveryLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=recovery-logger.d.ts.map