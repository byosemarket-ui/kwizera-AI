import { ProductIntelligenceHealthReport, ProductIntelligenceModuleRegistration } from "./types.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceAccessCoordinator } from "./product-intelligence-access-coordinator.js";
import { ProductIntelligenceRegistry } from "./product-intelligence-registry.js";
import { ProductIntelligenceStorageManager } from "./product-intelligence-storage.js";
export declare class ProductIntelligenceHealthMonitor {
    private readonly logger;
    private lastReport;
    constructor(logger: ProductIntelligenceFoundationLogger);
    runHealthCheck(storage: ProductIntelligenceStorageManager, registry: ProductIntelligenceRegistry, access: ProductIntelligenceAccessCoordinator, integrationReady: boolean): Promise<ProductIntelligenceHealthReport>;
    getLastReport(): ProductIntelligenceHealthReport | null;
    verifyRegistryHealth(modules: ProductIntelligenceModuleRegistration[]): boolean;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(intelligenceRoot: string): boolean;
}
//# sourceMappingURL=product-intelligence-health-monitor.d.ts.map