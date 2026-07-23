import { CreativeImageLogEntry, CreativeImageLogLevel } from "./creative-image-log-types.js";
export declare class CreativeImageLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: CreativeImageLogLevel, event: CreativeImageLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=creative-image-logger.d.ts.map