export type ProductionPlanningLogLevel = "debug" | "info" | "warn" | "error";
export type ProductionPlanningLogEvent = "startup" | "shutdown" | "production-planning" | "workflow" | "dependency" | "asset-validation" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "warning" | "error";
export interface ProductionPlanningLogEntry {
    timestamp: string;
    level: ProductionPlanningLogLevel;
    event: ProductionPlanningLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=production-planning-log-types.d.ts.map