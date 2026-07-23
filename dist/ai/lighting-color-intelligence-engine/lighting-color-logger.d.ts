import { LightingColorLogEntry, LightingColorLogLevel } from "./lighting-color-log-types.js";
export declare class LightingColorLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: LightingColorLogLevel, event: LightingColorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=lighting-color-logger.d.ts.map