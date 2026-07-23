export type BackgroundLogLevel = "debug" | "info" | "warn" | "error";
export type BackgroundLogEvent = "startup" | "analysis" | "classification" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "error";
export interface BackgroundLogEntry {
    timestamp: string;
    level: BackgroundLogLevel;
    event: BackgroundLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=background-log-types.d.ts.map