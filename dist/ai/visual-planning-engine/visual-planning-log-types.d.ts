export type VisualPlanningLogLevel = "debug" | "info" | "warn" | "error";
export type VisualPlanningLogEvent = "startup" | "shutdown" | "visual-planning" | "scene-planning" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "warning" | "error";
export interface VisualPlanningLogEntry {
    timestamp: string;
    level: VisualPlanningLogLevel;
    event: VisualPlanningLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=visual-planning-log-types.d.ts.map