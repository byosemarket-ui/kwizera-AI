import { AmbientAudioGenerationLogEntry, AmbientAudioGenerationLogLevel } from "./ambient-audio-generation-log-types.js";
export declare class AmbientAudioGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AmbientAudioGenerationLogLevel, event: AmbientAudioGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=ambient-audio-generation-logger.d.ts.map