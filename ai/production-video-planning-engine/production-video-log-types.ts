export type ProductionVideoLogLevel = "debug" | "info" | "warn" | "error";

export type ProductionVideoLogEvent =
  | "startup"
  | "shutdown"
  | "planning"
  | "workflow"
  | "asset"
  | "dependency"
  | "recommendation"
  | "relationship"
  | "validation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface ProductionVideoLogEntry {
  timestamp: string;
  level: ProductionVideoLogLevel;
  event: ProductionVideoLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
