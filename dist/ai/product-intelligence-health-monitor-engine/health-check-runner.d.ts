import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { ProductIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ProductIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { ProductIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { ProductIntelligenceResourceMonitor } from "./resource-monitor.js";
import { ProductIntelligenceHealthCheckResult } from "./types.js";
export declare class ProductIntelligenceHealthCheckRunner {
    private readonly foundation;
    private readonly moduleChecker;
    private readonly resourceMonitor;
    private readonly earlyWarning;
    private readonly autoRepair;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, moduleChecker: ProductIntelligenceModuleHealthChecker, resourceMonitor: ProductIntelligenceResourceMonitor, earlyWarning: ProductIntelligenceEarlyWarningSystem, autoRepair: ProductIntelligenceAutoRepairHandler, history: ProductIntelligenceHealthHistoryStore, logger: ProductIntelligenceHealthMonitorLogger);
    runCheck(): Promise<ProductIntelligenceHealthCheckResult>;
}
//# sourceMappingURL=health-check-runner.d.ts.map