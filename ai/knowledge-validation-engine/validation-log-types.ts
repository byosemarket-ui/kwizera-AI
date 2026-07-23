/**
 * KWIZERA AI STUDIO — Knowledge Validation Engine log types (Step 4M)
 */

export type KnowledgeValidationLogLevel = "info" | "warn" | "error";

export type KnowledgeValidationLogEvent =
  | "startup"
  | "validation"
  | "source"
  | "relationship"
  | "integrity"
  | "quality"
  | "consistency"
  | "repair"
  | "rejection"
  | "performance"
  | "warning";

export interface KnowledgeValidationLogEntry {
  timestamp: string;
  level: KnowledgeValidationLogLevel;
  event: KnowledgeValidationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
