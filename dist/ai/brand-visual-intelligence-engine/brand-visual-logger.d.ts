import { BrandVisualLogEntry, BrandVisualLogLevel } from "./brand-visual-log-types.js";
export declare class BrandVisualLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: BrandVisualLogLevel, event: BrandVisualLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=brand-visual-logger.d.ts.map