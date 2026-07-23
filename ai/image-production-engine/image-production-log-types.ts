export type ImageProductionLogLevel = "info" | "warn" | "error" | "debug";

export type ImageProductionLogEvent =
  | "startup"
  | "production-planning"
  | "workflow-validation"
  | "asset-validation"
  | "layer-validation"
  | "validation"
  | "recommendation"
  | "repair"
  | "search"
  | "performance"
  | "error";

export interface ImageProductionLogEntry {
  timestamp: string;
  level: ImageProductionLogLevel;
  event: ImageProductionLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
