import { MusicGenerationLogEntry, MusicGenerationLogLevel } from "./music-generation-log-types.js";
export declare class MusicGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MusicGenerationLogLevel, event: MusicGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=music-generation-logger.d.ts.map