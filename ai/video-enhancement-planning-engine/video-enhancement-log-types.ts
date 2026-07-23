export type VideoEnhancementLogLevel = "debug" | "info" | "warn" | "error";

export type VideoEnhancementLogEvent =
  | "startup"
  | "shutdown"
  | "planning"
  | "quality"
  | "recommendation"
  | "relationship"
  | "validation"
  | "platform"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface VideoEnhancementLogEntry {
  timestamp: string;
  level: VideoEnhancementLogLevel;
  event: VideoEnhancementLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
