import { AudioGenerationFoundationLogEntry, AudioGenerationFoundationLogLevel } from "./audio-generation-log-types.js";
export declare class AudioGenerationFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: AudioGenerationFoundationLogLevel, event: AudioGenerationFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<AudioGenerationFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-generation-logger.d.ts.map