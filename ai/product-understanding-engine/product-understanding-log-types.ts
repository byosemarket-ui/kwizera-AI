export type ProductUnderstandingLogLevel = "debug" | "info" | "warn" | "error";

export type ProductUnderstandingLogEvent =
  | "startup"
  | "shutdown"
  | "understanding"
  | "value-analysis"
  | "relationship"
  | "validation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface ProductUnderstandingLogEntry {
  timestamp: string;
  level: ProductUnderstandingLogLevel;
  event: ProductUnderstandingLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
