export type KnowledgeFoundationLogLevel = "debug" | "info" | "warn" | "error";

export interface KnowledgeFoundationLogEntry {
  timestamp: string;
  level: KnowledgeFoundationLogLevel;
  event:
    | "startup"
    | "shutdown"
    | "registration"
    | "access"
    | "validation"
    | "integrity"
    | "health"
    | "integration"
    | "recovery"
    | "performance"
    | "warning"
    | "error";
  message: string;
  data?: Record<string, unknown>;
}
