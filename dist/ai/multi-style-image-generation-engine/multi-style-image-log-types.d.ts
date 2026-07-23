export type MultiStyleImageLogLevel = "debug" | "info" | "warn" | "error";
export type MultiStyleImageLogEvent = "startup" | "style-planning" | "style-transformation" | "identity-preservation" | "validation" | "recommendation" | "relationship" | "search" | "repair" | "performance";
export interface MultiStyleImageLogEntry {
    timestamp: string;
    level: MultiStyleImageLogLevel;
    event: MultiStyleImageLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=multi-style-image-log-types.d.ts.map