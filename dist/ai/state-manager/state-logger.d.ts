import { StateManagerLogEntry, StateManagerLogLevel } from "./state-log-types.js";
export declare class StateManagerLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: StateManagerLogLevel, event: StateManagerLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<StateManagerLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=state-logger.d.ts.map