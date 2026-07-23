import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ProductIntelligenceAutoRepairResult, ProductIntelligenceHealthWarning } from "./types.js";
export declare class ProductIntelligenceAutoRepairHandler {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, logger: ProductIntelligenceHealthMonitorLogger);
    attemptRepairs(warnings: ProductIntelligenceHealthWarning[]): Promise<ProductIntelligenceAutoRepairResult>;
}
//# sourceMappingURL=auto-repair-handler.d.ts.map