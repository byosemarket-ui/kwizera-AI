import { AudioSynchronizationLogEntry, AudioSynchronizationLogLevel } from "./audio-synchronization-log-types.js";
export declare class AudioSynchronizationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudioSynchronizationLogLevel, event: AudioSynchronizationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-synchronization-logger.d.ts.map