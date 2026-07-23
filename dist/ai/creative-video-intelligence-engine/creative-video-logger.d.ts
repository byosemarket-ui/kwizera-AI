import { CreativeVideoLogEntry, CreativeVideoLogLevel } from "./creative-video-log-types.js";
export declare class CreativeVideoLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: CreativeVideoLogLevel, event: CreativeVideoLogEntry["event"], message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=creative-video-logger.d.ts.map