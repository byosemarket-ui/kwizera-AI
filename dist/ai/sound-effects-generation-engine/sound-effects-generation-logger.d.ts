import { SoundEffectsGenerationLogEntry, SoundEffectsGenerationLogLevel } from "./sound-effects-generation-log-types.js";
export declare class SoundEffectsGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: SoundEffectsGenerationLogLevel, event: SoundEffectsGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=sound-effects-generation-logger.d.ts.map