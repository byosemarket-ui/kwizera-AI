import { OptimizationLogEntry, OptimizationLogLevel } from "./optimization-log-types.js";
export declare class MemoryOptimizationLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: OptimizationLogLevel, event: OptimizationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=optimization-logger.d.ts.map