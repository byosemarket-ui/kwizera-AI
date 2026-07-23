export type VideoIntelligenceHealthMonitorLogLevel = "debug" | "info" | "warn" | "error";
export type VideoIntelligenceHealthMonitorLogEvent = "startup" | "shutdown" | "health-check" | "audit" | "diagnostics" | "warning" | "repair" | "performance" | "trend" | "search" | "validation" | "error";
export interface VideoIntelligenceHealthMonitorLogEntry {
    timestamp: string;
    level: VideoIntelligenceHealthMonitorLogLevel;
    event: VideoIntelligenceHealthMonitorLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=health-log-types.d.ts.map