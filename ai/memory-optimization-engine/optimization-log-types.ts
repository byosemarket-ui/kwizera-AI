export type OptimizationLogLevel = "debug" | "info" | "warn" | "error";

export type OptimizationLogEvent =
  | "startup"
  | "shutdown"
  | "analysis"
  | "optimization"
  | "duplicate"
  | "archive"
  | "cache"
  | "recovery"
  | "integrity"
  | "performance"
  | "warning"
  | "error";

export interface OptimizationLogEntry {
  timestamp: string;
  level: OptimizationLogLevel;
  event: OptimizationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
