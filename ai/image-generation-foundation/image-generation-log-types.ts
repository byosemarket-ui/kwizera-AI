export type ImageGenerationFoundationLogLevel = "info" | "warn" | "error" | "debug";

export type ImageGenerationFoundationLogEvent =
  | "startup"
  | "shutdown"
  | "registration"
  | "validation"
  | "integration"
  | "asset"
  | "blueprint"
  | "project"
  | "workflow"
  | "recovery"
  | "performance"
  | "error";

export interface ImageGenerationFoundationLogEntry {
  timestamp: string;
  level: ImageGenerationFoundationLogLevel;
  event: ImageGenerationFoundationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
