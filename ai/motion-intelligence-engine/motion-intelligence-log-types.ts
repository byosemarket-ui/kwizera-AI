export type MotionIntelligenceLogLevel = "debug" | "info" | "warn" | "error";

export type MotionIntelligenceLogEvent =
  | "startup"
  | "shutdown"
  | "analysis"
  | "tracking"
  | "event"
  | "planning"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface MotionIntelligenceLogEntry {
  timestamp: string;
  level: MotionIntelligenceLogLevel;
  event: MotionIntelligenceLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
