import { AudioProductionLogEntry, AudioProductionLogLevel } from "./audio-production-log-types.js";
export declare class AudioProductionLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudioProductionLogLevel, event: AudioProductionLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-production-logger.d.ts.map