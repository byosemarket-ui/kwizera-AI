import { TextToImageGenerationLogEntry, TextToImageGenerationLogLevel } from "./text-to-image-generation-log-types.js";
export declare class TextToImageGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: TextToImageGenerationLogLevel, event: TextToImageGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=text-to-image-generation-logger.d.ts.map