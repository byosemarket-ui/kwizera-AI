import { RecoveryEngineLogEntry, RecoveryEngineLogLevel } from "./recovery-log-types.js";
export declare class RecoveryEngineLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: RecoveryEngineLogLevel, event: RecoveryEngineLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<RecoveryEngineLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=recovery-logger.d.ts.map