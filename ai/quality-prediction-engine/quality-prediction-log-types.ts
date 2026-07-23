export type QualityPredictionLogLevel = "debug" | "info" | "warn" | "error";

export type QualityPredictionLogEvent =
  | "startup"
  | "shutdown"
  | "quality-analysis"
  | "prediction"
  | "recommendation"
  | "risk"
  | "relationship"
  | "validation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface QualityPredictionLogEntry {
  timestamp: string;
  level: QualityPredictionLogLevel;
  event: QualityPredictionLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
