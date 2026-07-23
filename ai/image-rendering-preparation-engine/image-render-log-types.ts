export type ImageRenderLogLevel = "info" | "warn" | "error" | "debug";

export type ImageRenderLogEvent =
  | "startup"
  | "render-preparation"
  | "validation"
  | "layer-validation"
  | "mask-validation"
  | "resource-planning"
  | "queue-planning"
  | "recovery"
  | "recommendation"
  | "repair"
  | "search"
  | "performance"
  | "error";

export interface ImageRenderLogEntry {
  timestamp: string;
  level: ImageRenderLogLevel;
  event: ImageRenderLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
