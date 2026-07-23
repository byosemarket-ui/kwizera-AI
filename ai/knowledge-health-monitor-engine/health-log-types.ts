export type KnowledgeHealthMonitorLogLevel = "debug" | "info" | "warn" | "error";

export type KnowledgeHealthMonitorLogEvent =
  | "startup"
  | "health-check"
  | "audit"
  | "warning"
  | "error"
  | "repair"
  | "diagnostics"
  | "performance"
  | "trend"
  | "recommendation"
  | "recovery";

export interface KnowledgeHealthMonitorLogEntry {
  timestamp: string;
  level: KnowledgeHealthMonitorLogLevel;
  event: KnowledgeHealthMonitorLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
