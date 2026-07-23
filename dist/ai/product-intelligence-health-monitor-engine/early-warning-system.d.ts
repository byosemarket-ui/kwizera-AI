import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceResourceMetrics } from "./resource-monitor.js";
import { MonitoredProductIntelligenceModuleHealthScore, ProductIntelligenceHealthWarning } from "./types.js";
export declare class ProductIntelligenceEarlyWarningSystem {
    private readonly foundation;
    constructor(foundation: AiProductIntelligenceFoundation);
    detect(moduleScores: MonitoredProductIntelligenceModuleHealthScore[], metrics: ProductIntelligenceResourceMetrics): Promise<ProductIntelligenceHealthWarning[]>;
    private warn;
}
//# sourceMappingURL=early-warning-system.d.ts.map