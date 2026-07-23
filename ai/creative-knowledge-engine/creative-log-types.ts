export type CreativeKnowledgeLogLevel = "info" | "warn" | "error" | "debug";

export interface CreativeKnowledgeLogEntry {
  timestamp: string;
  level: CreativeKnowledgeLogLevel;
  event:
    | "startup"
    | "analysis"
    | "validation"
    | "relationship"
    | "recommendation"
    | "learning"
    | "search"
    | "performance"
    | "error";
  message: string;
  data?: Record<string, unknown>;
}
