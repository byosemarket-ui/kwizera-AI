import { LearningMemoryLogEntry, LearningMemoryLogLevel } from "./learning-log-types.js";
export declare class LearningMemoryLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: LearningMemoryLogLevel, event: LearningMemoryLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=learning-logger.d.ts.map