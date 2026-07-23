export type BrandKnowledgeLogLevel = "info" | "warn" | "error" | "debug";

export interface BrandKnowledgeLogEntry {
  timestamp: string;
  level: BrandKnowledgeLogLevel;
  event:
    | "startup"
    | "analysis"
    | "validation"
    | "consistency"
    | "relationship"
    | "recommendation"
    | "learning"
    | "search"
    | "performance"
    | "error";
  message: string;
  data?: Record<string, unknown>;
}
