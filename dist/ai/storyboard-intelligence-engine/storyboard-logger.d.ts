import { StoryboardLogEntry, StoryboardLogLevel } from "./storyboard-log-types.js";
export declare class StoryboardLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: StoryboardLogLevel, event: StoryboardLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=storyboard-logger.d.ts.map