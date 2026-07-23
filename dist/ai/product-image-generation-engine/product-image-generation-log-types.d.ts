export type ProductImageGenerationLogLevel = "debug" | "info" | "warn" | "error";
export type ProductImageGenerationLogEvent = "startup" | "product-planning" | "photography-planning" | "background-planning" | "lighting-planning" | "consistency" | "validation" | "recommendation" | "relationship" | "search" | "repair" | "performance" | "marketing-variation";
export interface ProductImageGenerationLogEntry {
    timestamp: string;
    level: ProductImageGenerationLogLevel;
    event: ProductImageGenerationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=product-image-generation-log-types.d.ts.map