export type BackgroundGenerationLogLevel = "debug" | "info" | "warn" | "error";

export type BackgroundGenerationLogEvent =
  | "startup"
  | "background-analysis"
  | "background-generation"
  | "background-replacement"
  | "lighting-matching"
  | "depth-planning"
  | "subject-preservation"
  | "validation"
  | "recommendation"
  | "relationship"
  | "search"
  | "repair"
  | "performance";

export interface BackgroundGenerationLogEntry {
  timestamp: string;
  level: BackgroundGenerationLogLevel;
  event: BackgroundGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
