export type ImageQualityPredictionLogLevel = "debug" | "info" | "warn" | "error";

export type ImageQualityPredictionLogEvent =
  | "startup"
  | "prediction"
  | "quality"
  | "risk"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "error";

export interface ImageQualityPredictionLogEntry {
  timestamp: string;
  level: ImageQualityPredictionLogLevel;
  event: ImageQualityPredictionLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
