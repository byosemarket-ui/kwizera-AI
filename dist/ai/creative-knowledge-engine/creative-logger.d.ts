import { CreativeKnowledgeLogEntry, CreativeKnowledgeLogLevel } from "./creative-log-types.js";
export declare class CreativeKnowledgeLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: CreativeKnowledgeLogLevel, event: CreativeKnowledgeLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=creative-logger.d.ts.map