export type MarketingKnowledgeLogLevel = "info" | "warn" | "error" | "debug";
export interface MarketingKnowledgeLogEntry {
    timestamp: string;
    level: MarketingKnowledgeLogLevel;
    event: "startup" | "analysis" | "customer" | "validation" | "relationship" | "recommendation" | "learning" | "search" | "performance" | "error";
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=marketing-log-types.d.ts.map