export type PlanningLogLevel = "debug" | "info" | "warn" | "error";

export type PlanningLogEvent =
  | "planning"
  | "plan"
  | "validation"
  | "warning"
  | "error"
  | "recovery";

export interface PlanningLogEntry {
  timestamp: string;
  level: PlanningLogLevel;
  event: PlanningLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
