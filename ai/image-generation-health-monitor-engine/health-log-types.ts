export type ImageGenerationHealthMonitorLogLevel = "debug" | "info" | "warn" | "error";

export type ImageGenerationHealthMonitorLogEvent =
  | "startup"
  | "health-check"
  | "audit"
  | "repair"
  | "warning"
  | "diagnostics"
  | "performance"
  | "trend";

export interface ImageGenerationHealthMonitorLogEntry {
  timestamp: string;
  level: ImageGenerationHealthMonitorLogLevel;
  event: ImageGenerationHealthMonitorLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
