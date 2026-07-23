import { AudioQualityValidationLogEntry, AudioQualityValidationLogLevel } from "./audio-quality-validation-log-types.js";
export declare class AudioQualityValidationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AudioQualityValidationLogLevel, event: AudioQualityValidationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=audio-quality-validation-logger.d.ts.map