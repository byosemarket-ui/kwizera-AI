import { ProductImageGenerationLogEntry, ProductImageGenerationLogLevel } from "./product-image-generation-log-types.js";
export declare class ProductImageGenerationLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProductImageGenerationLogLevel, event: ProductImageGenerationLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=product-image-generation-logger.d.ts.map