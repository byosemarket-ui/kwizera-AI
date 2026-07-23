export type ReasoningLogLevel = "debug" | "info" | "warn" | "error";

export type ReasoningLogEvent =
  | "reasoning"
  | "recommendation"
  | "confidence"
  | "error"
  | "warning"
  | "recovery";

export interface ReasoningLogEntry {
  timestamp: string;
  level: ReasoningLogLevel;
  event: ReasoningLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
