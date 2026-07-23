/**
 * KWIZERA AI STUDIO — Knowledge Optimization Engine log types (Step 4L)
 */
export type KnowledgeOptimizationLogLevel = "info" | "warn" | "error";
export type KnowledgeOptimizationLogEvent = "startup" | "analysis" | "optimization" | "duplicate" | "cache" | "recovery" | "quality" | "classification" | "relationship" | "graph" | "performance" | "warning";
export interface KnowledgeOptimizationLogEntry {
    timestamp: string;
    level: KnowledgeOptimizationLogLevel;
    event: KnowledgeOptimizationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=optimization-log-types.d.ts.map