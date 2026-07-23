import { ProductionPlanningLogEntry, ProductionPlanningLogLevel } from "./production-planning-log-types.js";
export declare class ProductionPlanningLogger {
    private logFilePath;
    initialize(logDirectory: string): void;
    log(level: ProductionPlanningLogLevel, event: ProductionPlanningLogEntry["event"], message: string, data?: Record<string, unknown>): void;
    getLogFilePath(): string | null;
}
//# sourceMappingURL=production-planning-logger.d.ts.map