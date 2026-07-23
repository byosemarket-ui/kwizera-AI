import { TextToSpeechGenerationLogEntry, TextToSpeechGenerationLogLevel } from "./text-to-speech-generation-log-types.js";
export declare class TextToSpeechGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: TextToSpeechGenerationLogLevel, event: TextToSpeechGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=text-to-speech-generation-logger.d.ts.map