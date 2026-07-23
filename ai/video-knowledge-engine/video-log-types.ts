export type VideoKnowledgeLogLevel = "debug" | "info" | "warn" | "error";

export type VideoKnowledgeLogEvent =
  | "startup"
  | "analysis"
  | "scene"
  | "learning"
  | "relationship"
  | "recommendation"
  | "search"
  | "validation"
  | "storage"
  | "performance"
  | "warning"
  | "error";

export interface VideoKnowledgeLogEntry {
  timestamp: string;
  level: VideoKnowledgeLogLevel;
  event: VideoKnowledgeLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
