import { ModuleManagerLogEntry, ModuleManagerLogLevel } from "./module-log-types.js";
export declare class ModuleManagerLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ModuleManagerLogLevel, event: ModuleManagerLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ModuleManagerLogEntry>;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=module-logger.d.ts.map