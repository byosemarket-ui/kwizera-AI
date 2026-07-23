import { ProductAnalysisLogEntry, ProductAnalysisLogLevel } from "./product-analysis-log-types.js";
export declare class ProductAnalysisLogger {
    private logDirectory;
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ProductAnalysisLogLevel, event: ProductAnalysisLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getEntries(): ReadonlyArray<ProductAnalysisLogEntry>;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=product-analysis-logger.d.ts.map