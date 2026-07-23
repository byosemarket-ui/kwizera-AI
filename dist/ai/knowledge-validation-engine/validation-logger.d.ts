import { KnowledgeValidationLogEvent, KnowledgeValidationLogLevel } from "./validation-log-types.js";
export declare class KnowledgeValidationLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: KnowledgeValidationLogLevel, event: KnowledgeValidationLogEvent, message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=validation-logger.d.ts.map