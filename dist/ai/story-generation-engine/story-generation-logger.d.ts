import { StoryGenerationLogEntry, StoryGenerationLogLevel } from "./story-generation-log-types.js";
export declare class StoryGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: StoryGenerationLogLevel, event: StoryGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=story-generation-logger.d.ts.map