import { VisualEffectsGenerationLogEntry, VisualEffectsGenerationLogLevel } from "./visual-effects-generation-log-types.js";
export declare class VisualEffectsGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: VisualEffectsGenerationLogLevel, event: VisualEffectsGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=visual-effects-generation-logger.d.ts.map