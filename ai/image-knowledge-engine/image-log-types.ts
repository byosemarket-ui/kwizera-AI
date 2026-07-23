export type ImageKnowledgeLogLevel = "debug" | "info" | "warn" | "error";

export type ImageKnowledgeLogEvent =
  | "startup"
  | "analysis"
  | "learning"
  | "relationship"
  | "recommendation"
  | "search"
  | "validation"
  | "storage"
  | "performance"
  | "warning"
  | "error";

export interface ImageKnowledgeLogEntry {
  timestamp: string;
  level: ImageKnowledgeLogLevel;
  event: ImageKnowledgeLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
