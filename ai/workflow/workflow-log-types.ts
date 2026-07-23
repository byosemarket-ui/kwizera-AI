export type WorkflowLogLevel = "debug" | "info" | "warn" | "error";

export type WorkflowLogEvent =
  | "workflow-start"
  | "workflow-end"
  | "task"
  | "task-failure"
  | "recovery"
  | "performance"
  | "warning"
  | "error";

export interface WorkflowLogEntry {
  timestamp: string;
  level: WorkflowLogLevel;
  event: WorkflowLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
