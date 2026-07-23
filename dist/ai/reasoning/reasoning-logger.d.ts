import { ReasoningLogEntry, ReasoningLogLevel } from "./reasoning-log-types.js";
export declare class ReasoningLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ReasoningLogLevel, event: ReasoningLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ReasoningLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=reasoning-logger.d.ts.map