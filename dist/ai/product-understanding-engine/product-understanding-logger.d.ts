import { ProductUnderstandingLogEntry, ProductUnderstandingLogLevel } from "./product-understanding-log-types.js";
export declare class ProductUnderstandingLogger {
    private logFilePath;
    private readonly entries;
    initialize(logDirectory: string): void;
    log(level: ProductUnderstandingLogLevel, event: ProductUnderstandingLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=product-understanding-logger.d.ts.map