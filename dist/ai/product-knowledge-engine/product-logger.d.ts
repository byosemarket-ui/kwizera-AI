import { ProductKnowledgeLogEntry, ProductKnowledgeLogLevel } from "./product-log-types.js";
export declare class ProductKnowledgeLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProductKnowledgeLogLevel, event: ProductKnowledgeLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=product-logger.d.ts.map