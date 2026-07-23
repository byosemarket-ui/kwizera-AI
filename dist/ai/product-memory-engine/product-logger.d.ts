import { ProductMemoryLogEntry, ProductMemoryLogLevel } from "./product-log-types.js";
export declare class ProductMemoryLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProductMemoryLogLevel, event: ProductMemoryLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=product-logger.d.ts.map