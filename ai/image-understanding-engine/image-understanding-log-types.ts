export type ImageUnderstandingLogLevel = "debug" | "info" | "warn" | "error";

export type ImageUnderstandingLogEvent =
  | "startup"
  | "shutdown"
  | "understanding"
  | "scene"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface ImageUnderstandingLogEntry {
  timestamp: string;
  level: ImageUnderstandingLogLevel;
  event: ImageUnderstandingLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
