import { KnowledgeOptimizationLogEvent, KnowledgeOptimizationLogLevel } from "./optimization-log-types.js";
export declare class KnowledgeOptimizationLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: KnowledgeOptimizationLogLevel, event: KnowledgeOptimizationLogEvent, message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=optimization-logger.d.ts.map