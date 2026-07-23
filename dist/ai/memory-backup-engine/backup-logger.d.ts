import { BackupLogEntry, BackupLogLevel } from "./backup-log-types.js";
export declare class MemoryBackupLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: BackupLogLevel, event: BackupLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=backup-logger.d.ts.map