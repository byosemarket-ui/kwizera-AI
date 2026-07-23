export type AudioRenderLogLevel = "info" | "warn" | "error" | "debug";

export type AudioRenderLogEvent =
  | "startup"
  | "render-preparation"
  | "validation"
  | "track-validation"
  | "timeline-validation"
  | "resource-planning"
  | "queue-planning"
  | "recovery"
  | "recommendation"
  | "repair"
  | "search"
  | "performance"
  | "error";

export interface AudioRenderLogEntry {
  timestamp: string;
  level: AudioRenderLogLevel;
  event: AudioRenderLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
