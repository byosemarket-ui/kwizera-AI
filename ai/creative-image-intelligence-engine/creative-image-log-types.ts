export type CreativeImageLogLevel = "debug" | "info" | "warn" | "error";

export type CreativeImageLogEvent =
  | "startup"
  | "planning"
  | "layout"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "error";

export interface CreativeImageLogEntry {
  timestamp: string;
  level: CreativeImageLogLevel;
  event: CreativeImageLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
