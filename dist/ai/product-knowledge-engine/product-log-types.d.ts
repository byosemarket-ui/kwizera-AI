export type ProductKnowledgeLogLevel = "info" | "warn" | "error" | "debug";
export interface ProductKnowledgeLogEntry {
    timestamp: string;
    level: ProductKnowledgeLogLevel;
    event: "startup" | "analysis" | "validation" | "relationship" | "recommendation" | "learning" | "search" | "performance" | "error";
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=product-log-types.d.ts.map