export type KnowledgeStorageLogLevel = "debug" | "info" | "warn" | "error";

export interface KnowledgeStorageLogEntry {
  timestamp: string;
  level: KnowledgeStorageLogLevel;
  event:
    | "startup"
    | "create"
    | "update"
    | "rollback"
    | "validation"
    | "version"
    | "classification"
    | "integrity"
    | "duplicate"
    | "performance"
    | "warning"
    | "error";
  message: string;
  data?: Record<string, unknown>;
}
