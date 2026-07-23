export type BrandVisualLogLevel = "debug" | "info" | "warn" | "error";

export type BrandVisualLogEvent =
  | "startup"
  | "analysis"
  | "validation"
  | "relationship"
  | "recommendation"
  | "search"
  | "performance"
  | "error";

export interface BrandVisualLogEntry {
  timestamp: string;
  level: BrandVisualLogLevel;
  event: BrandVisualLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
