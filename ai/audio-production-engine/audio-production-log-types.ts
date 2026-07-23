export type AudioProductionLogLevel = "info" | "warn" | "error" | "debug";

export type AudioProductionLogEvent =
  | "startup"
  | "shutdown"
  | "production-planning"
  | "workflow-validation"
  | "asset-validation"
  | "track-validation"
  | "dependency-validation"
  | "render-preparation"
  | "export-preparation"
  | "blueprint-generation"
  | "validation"
  | "recommendation"
  | "search"
  | "repair"
  | "performance"
  | "error";

export interface AudioProductionLogEntry {
  timestamp: string;
  level: AudioProductionLogLevel;
  event: AudioProductionLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
