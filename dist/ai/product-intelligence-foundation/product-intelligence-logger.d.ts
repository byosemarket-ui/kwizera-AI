import { ProductIntelligenceFoundationLogEntry, ProductIntelligenceFoundationLogLevel } from "./product-intelligence-log-types.js";
export declare class ProductIntelligenceFoundationLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ProductIntelligenceFoundationLogLevel, event: ProductIntelligenceFoundationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ProductIntelligenceFoundationLogEntry>;
    getLogDirectory(): string | null;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=product-intelligence-logger.d.ts.map