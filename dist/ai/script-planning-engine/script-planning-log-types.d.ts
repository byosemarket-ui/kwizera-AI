export type ScriptPlanningLogLevel = "debug" | "info" | "warn" | "error";
export type ScriptPlanningLogEvent = "startup" | "shutdown" | "script-planning" | "scene-planning" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "warning" | "error";
export interface ScriptPlanningLogEntry {
    timestamp: string;
    level: ScriptPlanningLogLevel;
    event: ScriptPlanningLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=script-planning-log-types.d.ts.map