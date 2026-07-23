import { ProductionVideoLogEntry, ProductionVideoLogLevel } from "./production-video-log-types.js";
export declare class ProductionVideoLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProductionVideoLogLevel, event: ProductionVideoLogEntry["event"], message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=production-video-logger.d.ts.map