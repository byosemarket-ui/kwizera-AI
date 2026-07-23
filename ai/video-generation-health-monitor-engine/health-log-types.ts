export type VideoGenerationHealthMonitorLogLevel = "debug" | "info" | "warn" | "error";

export type VideoGenerationHealthMonitorLogEvent =
  | "startup"
  | "health-check"
  | "audit"
  | "repair"
  | "warning"
  | "diagnostics"
  | "performance"
  | "trend";

export interface VideoGenerationHealthMonitorLogEntry {
  timestamp: string;
  level: VideoGenerationHealthMonitorLogLevel;
  event: VideoGenerationHealthMonitorLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
