import { ProductIntelligenceAccessRequest, ProductIntelligenceAccessResult } from "./types.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceHistoryStore } from "./product-intelligence-history-store.js";
import { ProductIntelligenceRegistry } from "./product-intelligence-registry.js";
import { ProductIntelligenceStorageManager } from "./product-intelligence-storage.js";
export declare class ProductIntelligenceAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private readonly storage;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: ProductIntelligenceFoundationLogger, history: ProductIntelligenceHistoryStore, registry: ProductIntelligenceRegistry, storage: ProductIntelligenceStorageManager);
    requestAccess(request: ProductIntelligenceAccessRequest): Promise<ProductIntelligenceAccessResult>;
    private recordAccess;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=product-intelligence-access-coordinator.d.ts.map