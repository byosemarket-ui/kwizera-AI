export type CompositionLogLevel = "debug" | "info" | "warn" | "error";
export type CompositionLogEvent = "startup" | "analysis" | "hierarchy" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "error";
export interface CompositionLogEntry {
    timestamp: string;
    level: CompositionLogLevel;
    event: CompositionLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=composition-log-types.d.ts.map