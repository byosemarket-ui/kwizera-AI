export type LanguageKnowledgeLogLevel = "info" | "warn" | "error" | "debug";

export interface LanguageKnowledgeLogEntry {
  timestamp: string;
  level: LanguageKnowledgeLogLevel;
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
