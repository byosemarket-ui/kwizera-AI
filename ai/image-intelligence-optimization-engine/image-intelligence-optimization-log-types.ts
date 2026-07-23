export type ImageIntelligenceOptimizationLogLevel = "debug" | "info" | "warn" | "error";

export type ImageIntelligenceOptimizationLogEvent =
  | "startup"
  | "shutdown"
  | "optimization"
  | "recovery"
  | "performance"
  | "relationship"
  | "recommendation"
  | "cache"
  | "validation"
  | "search"
  | "warning"
  | "error";

export interface ImageIntelligenceOptimizationLogEntry {
  timestamp: string;
  level: ImageIntelligenceOptimizationLogLevel;
  event: ImageIntelligenceOptimizationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
