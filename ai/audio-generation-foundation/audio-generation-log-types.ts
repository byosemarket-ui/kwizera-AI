export type AudioGenerationFoundationLogLevel = "info" | "warn" | "error" | "debug";

export type AudioGenerationFoundationLogEvent =
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

export interface AudioGenerationFoundationLogEntry {
  timestamp: string;
  level: AudioGenerationFoundationLogLevel;
  event: AudioGenerationFoundationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
