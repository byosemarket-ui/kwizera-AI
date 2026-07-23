export type HealthMonitorLogLevel = "debug" | "info" | "warn" | "error";
export type HealthMonitorLogEvent = "startup" | "shutdown" | "health-check" | "audit" | "warning" | "error" | "repair" | "diagnostics" | "performance" | "trend" | "recommendation";
export interface HealthMonitorLogEntry {
    timestamp: string;
    level: HealthMonitorLogLevel;
    event: HealthMonitorLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=health-log-types.d.ts.map