import { DecisionLogEntry, DecisionLogLevel } from "./decision-log-types.js";
export declare class DecisionLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: DecisionLogLevel, event: DecisionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<DecisionLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=decision-logger.d.ts.map