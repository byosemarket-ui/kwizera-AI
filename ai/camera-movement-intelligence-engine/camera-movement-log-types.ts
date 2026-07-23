export type CameraMovementLogLevel = "debug" | "info" | "warn" | "error";

export type CameraMovementLogEvent =
  | "startup"
  | "shutdown"
  | "analysis"
  | "planning"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface CameraMovementLogEntry {
  timestamp: string;
  level: CameraMovementLogLevel;
  event: CameraMovementLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
