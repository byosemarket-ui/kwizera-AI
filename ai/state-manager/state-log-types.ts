export type StateManagerLogLevel = "debug" | "info" | "warn" | "error";

export type StateManagerLogEvent =
  | "state-change"
  | "snapshot"
  | "restoration"
  | "recovery"
  | "auto-save"
  | "failure"
  | "warning";

export interface StateManagerLogEntry {
  timestamp: string;
  level: StateManagerLogLevel;
  event: StateManagerLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
