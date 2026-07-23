export type CreativeDirectionLogLevel = "debug" | "info" | "warn" | "error";
export type CreativeDirectionLogEvent = "startup" | "shutdown" | "creative-planning" | "creative-direction" | "relationship" | "recommendation" | "validation" | "search" | "performance" | "warning" | "error";
export interface CreativeDirectionLogEntry {
    timestamp: string;
    level: CreativeDirectionLogLevel;
    event: CreativeDirectionLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=creative-direction-log-types.d.ts.map