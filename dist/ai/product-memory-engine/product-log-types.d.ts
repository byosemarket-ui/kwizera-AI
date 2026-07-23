export type ProductMemoryLogLevel = "debug" | "info" | "warn" | "error";
export type ProductMemoryLogEvent = "startup" | "shutdown" | "product-create" | "product-update" | "product-learn" | "pattern-detection" | "relationship" | "learning" | "preference" | "search" | "performance" | "warning" | "error";
export interface ProductMemoryLogEntry {
    timestamp: string;
    level: ProductMemoryLogLevel;
    event: ProductMemoryLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=product-log-types.d.ts.map