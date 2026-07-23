import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
export interface ProductIntelligenceResourceMetrics {
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    relationshipDetectionMs: number;
}
export declare class ProductIntelligenceResourceMonitor {
    private readonly foundation;
    private readonly storageRoot;
    constructor(foundation: AiProductIntelligenceFoundation, storageRoot: string);
    measure(): ProductIntelligenceResourceMetrics;
    private dirSize;
}
export declare function deriveProductIntelligencePerformanceIssues(metrics: ProductIntelligenceResourceMetrics): string[];
//# sourceMappingURL=resource-monitor.d.ts.map