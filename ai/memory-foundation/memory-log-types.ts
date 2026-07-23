export type MemoryFoundationLogLevel = "debug" | "info" | "warn" | "error";

export type MemoryFoundationLogEvent =
  | "startup"
  | "shutdown"
  | "registration"
  | "access"
  | "integrity"
  | "backup"
  | "recovery"
  | "health"
  | "performance"
  | "warning"
  | "error";

export interface MemoryFoundationLogEntry {
  timestamp: string;
  level: MemoryFoundationLogLevel;
  event: MemoryFoundationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
