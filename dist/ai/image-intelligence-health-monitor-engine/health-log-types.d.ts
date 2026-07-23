export type ImageIntelligenceHealthMonitorLogLevel = "debug" | "info" | "warn" | "error";
export type ImageIntelligenceHealthMonitorLogEvent = "startup" | "shutdown" | "health-check" | "audit" | "warning" | "repair" | "performance" | "trend" | "diagnostics" | "error";
export interface ImageIntelligenceHealthMonitorLogEntry {
    timestamp: string;
    level: ImageIntelligenceHealthMonitorLogLevel;
    event: ImageIntelligenceHealthMonitorLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=health-log-types.d.ts.map