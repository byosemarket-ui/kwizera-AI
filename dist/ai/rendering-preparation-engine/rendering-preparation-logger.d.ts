import { RenderingPreparationLogEntry, RenderingPreparationLogLevel } from "./rendering-preparation-log-types.js";
export declare class RenderingPreparationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: RenderingPreparationLogLevel, event: RenderingPreparationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=rendering-preparation-logger.d.ts.map