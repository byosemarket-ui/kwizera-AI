export type BackupLogLevel = "debug" | "info" | "warn" | "error";

export type BackupLogEvent =
  | "startup"
  | "shutdown"
  | "create"
  | "validate"
  | "compress"
  | "verify"
  | "restore"
  | "restore-point"
  | "schedule"
  | "retention"
  | "performance"
  | "warning"
  | "error";

export interface BackupLogEntry {
  timestamp: string;
  level: BackupLogLevel;
  event: BackupLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
