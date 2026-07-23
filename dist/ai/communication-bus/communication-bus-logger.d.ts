import { CommunicationBusLogEntry, CommunicationBusLogLevel } from "./bus-log-types.js";
export declare class CommunicationBusLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: CommunicationBusLogLevel, event: CommunicationBusLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<CommunicationBusLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=communication-bus-logger.d.ts.map