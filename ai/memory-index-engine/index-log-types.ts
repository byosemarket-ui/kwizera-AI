export type MemoryIndexLogLevel = "debug" | "info" | "warn" | "error";

export type MemoryIndexLogEvent =
  | "startup"
  | "shutdown"
  | "create"
  | "update"
  | "remove"
  | "rebuild"
  | "optimize"
  | "health"
  | "relationship"
  | "performance"
  | "warning"
  | "error";

export interface MemoryIndexLogEntry {
  timestamp: string;
  level: MemoryIndexLogLevel;
  event: MemoryIndexLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
