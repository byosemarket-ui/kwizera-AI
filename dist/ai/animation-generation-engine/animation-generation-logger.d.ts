import { AnimationGenerationLogEntry, AnimationGenerationLogLevel } from "./animation-generation-log-types.js";
export declare class AnimationGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: AnimationGenerationLogLevel, event: AnimationGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=animation-generation-logger.d.ts.map