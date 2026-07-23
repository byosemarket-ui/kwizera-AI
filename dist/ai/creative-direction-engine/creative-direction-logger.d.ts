import { CreativeDirectionLogEntry, CreativeDirectionLogLevel } from "./creative-direction-log-types.js";
export declare class CreativeDirectionLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: CreativeDirectionLogLevel, event: CreativeDirectionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=creative-direction-logger.d.ts.map