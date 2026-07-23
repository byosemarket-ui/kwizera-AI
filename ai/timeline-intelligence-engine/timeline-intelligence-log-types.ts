export type TimelineIntelligenceLogLevel = "debug" | "info" | "warn" | "error";

export type TimelineIntelligenceLogEvent =
  | "startup"
  | "shutdown"
  | "timeline"
  | "sync"
  | "track"
  | "relationship"
  | "validation"
  | "recommendation"
  | "indexing"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface TimelineIntelligenceLogEntry {
  timestamp: string;
  level: TimelineIntelligenceLogLevel;
  event: TimelineIntelligenceLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
