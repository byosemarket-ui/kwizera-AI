import { ProductIntelligenceHealthMonitorLogEntry, ProductIntelligenceHealthMonitorLogLevel } from "./health-log-types.js";
export declare class ProductIntelligenceHealthMonitorLogger {
    private logDirectory;
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProductIntelligenceHealthMonitorLogLevel, event: ProductIntelligenceHealthMonitorLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogDirectory(): string | null;
}
//# sourceMappingURL=health-logger.d.ts.map