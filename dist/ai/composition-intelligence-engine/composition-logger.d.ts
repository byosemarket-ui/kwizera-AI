import { CompositionLogEntry, CompositionLogLevel } from "./composition-log-types.js";
export declare class CompositionLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: CompositionLogLevel, event: CompositionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=composition-logger.d.ts.map