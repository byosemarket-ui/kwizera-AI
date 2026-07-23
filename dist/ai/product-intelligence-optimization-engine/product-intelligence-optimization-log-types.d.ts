export type ProductIntelligenceOptimizationLogLevel = "debug" | "info" | "warn" | "error";
export type ProductIntelligenceOptimizationLogEvent = "startup" | "shutdown" | "optimization" | "recovery" | "performance" | "relationship" | "recommendation" | "cache" | "validation" | "search" | "warning" | "error";
export interface ProductIntelligenceOptimizationLogEntry {
    timestamp: string;
    level: ProductIntelligenceOptimizationLogLevel;
    event: ProductIntelligenceOptimizationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=product-intelligence-optimization-log-types.d.ts.map