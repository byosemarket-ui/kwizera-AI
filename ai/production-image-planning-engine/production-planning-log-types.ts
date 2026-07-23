export type ProductionPlanningLogLevel = "debug" | "info" | "warn" | "error";

export type ProductionPlanningLogEvent =
  | "startup"
  | "planning"
  | "workflow"
  | "dependency"
  | "asset"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "error";

export interface ProductionPlanningLogEntry {
  timestamp: string;
  level: ProductionPlanningLogLevel;
  event: ProductionPlanningLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
