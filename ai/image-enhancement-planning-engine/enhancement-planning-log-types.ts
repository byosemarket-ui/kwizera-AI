export type EnhancementPlanningLogLevel = "debug" | "info" | "warn" | "error";

export type EnhancementPlanningLogEvent =
  | "startup"
  | "planning"
  | "quality"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "error";

export interface EnhancementPlanningLogEntry {
  timestamp: string;
  level: EnhancementPlanningLogLevel;
  event: EnhancementPlanningLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
