import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { MonitoredProductIntelligenceModuleHealthScore, ProductIntelligenceHealthScoreLevel } from "./types.js";
export declare class ProductIntelligenceModuleHealthChecker {
    private readonly foundation;
    constructor(foundation: AiProductIntelligenceFoundation);
    checkAll(): MonitoredProductIntelligenceModuleHealthScore[];
    scoreToLevel(score: number): ProductIntelligenceHealthScoreLevel;
    private checkModule;
}
//# sourceMappingURL=module-health-checker.d.ts.map