import { ImageKnowledgeLogEntry, ImageKnowledgeLogLevel } from "./image-log-types.js";
export declare class ImageKnowledgeLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ImageKnowledgeLogLevel, event: ImageKnowledgeLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=image-logger.d.ts.map