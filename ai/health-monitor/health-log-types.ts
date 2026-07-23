export type HealthMonitorLogLevel = "debug" | "info" | "warn" | "error";

export type HealthMonitorLogEvent =
  | "scan"
  | "warning"
  | "critical"
  | "alert"
  | "recovery"
  | "performance";

export interface HealthMonitorLogEntry {
  timestamp: string;
  level: HealthMonitorLogLevel;
  event: HealthMonitorLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
