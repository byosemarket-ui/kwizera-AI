export type ImageAnalysisLogLevel = "debug" | "info" | "warn" | "error";

export type ImageAnalysisLogEvent =
  | "startup"
  | "shutdown"
  | "analysis"
  | "classification"
  | "relationship"
  | "validation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface ImageAnalysisLogEntry {
  timestamp: string;
  level: ImageAnalysisLogLevel;
  event: ImageAnalysisLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
