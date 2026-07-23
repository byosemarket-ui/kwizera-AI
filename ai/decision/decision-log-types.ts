export type DecisionLogLevel = "debug" | "info" | "warn" | "error";

export type DecisionLogEvent =
  | "decision"
  | "validation"
  | "error"
  | "warning"
  | "recovery";

export interface DecisionLogEntry {
  timestamp: string;
  level: DecisionLogLevel;
  event: DecisionLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
