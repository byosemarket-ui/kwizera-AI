export type VideoMemoryLogLevel = "debug" | "info" | "warn" | "error";

export type VideoMemoryLogEvent =
  | "startup"
  | "shutdown"
  | "video-create"
  | "video-update"
  | "video-complete"
  | "pattern-detection"
  | "relationship"
  | "learning"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface VideoMemoryLogEntry {
  timestamp: string;
  level: VideoMemoryLogLevel;
  event: VideoMemoryLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
