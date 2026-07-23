export type ImageEditingLogLevel = "debug" | "info" | "warn" | "error";

export type ImageEditingLogEvent =
  | "startup"
  | "image-analysis"
  | "editing-operation"
  | "inpainting"
  | "outpainting"
  | "mask-management"
  | "identity-preservation"
  | "validation"
  | "recommendation"
  | "relationship"
  | "search"
  | "repair"
  | "performance";

export interface ImageEditingLogEntry {
  timestamp: string;
  level: ImageEditingLogLevel;
  event: ImageEditingLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
