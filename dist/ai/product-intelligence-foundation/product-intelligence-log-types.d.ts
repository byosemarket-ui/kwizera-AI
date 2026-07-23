export type ProductIntelligenceFoundationLogLevel = "debug" | "info" | "warn" | "error";
export type ProductIntelligenceFoundationLogEvent = "startup" | "shutdown" | "registration" | "access" | "validation" | "integrity" | "health" | "integration" | "recovery" | "lifecycle" | "performance" | "warning" | "error";
export interface ProductIntelligenceFoundationLogEntry {
    timestamp: string;
    level: ProductIntelligenceFoundationLogLevel;
    event: ProductIntelligenceFoundationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=product-intelligence-log-types.d.ts.map