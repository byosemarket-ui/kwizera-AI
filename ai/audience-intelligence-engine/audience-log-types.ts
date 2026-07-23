export type AudienceLogLevel = "debug" | "info" | "warn" | "error";

export type AudienceLogEvent =
  | "startup"
  | "shutdown"
  | "audience-analysis"
  | "segmentation"
  | "relationship"
  | "validation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface AudienceLogEntry {
  timestamp: string;
  level: AudienceLogLevel;
  event: AudienceLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
