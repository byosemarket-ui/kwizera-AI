export type TaskManagerLogLevel = "debug" | "info" | "warn" | "error";

export type TaskManagerLogEvent =
  | "task-create"
  | "task-start"
  | "task-complete"
  | "task-failure"
  | "task-retry"
  | "task-recovery"
  | "task-cancel"
  | "warning"
  | "error";

export interface TaskManagerLogEntry {
  timestamp: string;
  level: TaskManagerLogLevel;
  event: TaskManagerLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
