export type ProductAnalysisLogLevel = "debug" | "info" | "warn" | "error";

export type ProductAnalysisLogEvent =
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

export interface ProductAnalysisLogEntry {
  timestamp: string;
  level: ProductAnalysisLogLevel;
  event: ProductAnalysisLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
