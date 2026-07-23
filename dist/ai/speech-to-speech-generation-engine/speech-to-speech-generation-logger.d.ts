import { SpeechToSpeechGenerationLogEntry, SpeechToSpeechGenerationLogLevel } from "./speech-to-speech-generation-log-types.js";
export declare class SpeechToSpeechGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: SpeechToSpeechGenerationLogLevel, event: SpeechToSpeechGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=speech-to-speech-generation-logger.d.ts.map