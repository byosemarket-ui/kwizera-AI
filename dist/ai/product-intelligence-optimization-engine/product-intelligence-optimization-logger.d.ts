import { ProductIntelligenceOptimizationLogEntry, ProductIntelligenceOptimizationLogLevel } from "./product-intelligence-optimization-log-types.js";
export declare class ProductIntelligenceOptimizationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProductIntelligenceOptimizationLogLevel, event: ProductIntelligenceOptimizationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=product-intelligence-optimization-logger.d.ts.map