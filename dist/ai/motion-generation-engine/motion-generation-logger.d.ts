import { MotionGenerationLogEntry, MotionGenerationLogLevel } from "./motion-generation-log-types.js";
export declare class MotionGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: MotionGenerationLogLevel, event: MotionGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=motion-generation-logger.d.ts.map