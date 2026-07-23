export type ImageGenerationOptimizationLogLevel = "info" | "warn" | "error" | "debug";

export type ImageGenerationOptimizationLogEvent =
  | "startup"
  | "optimization"
  | "resource-improvement"
  | "performance-improvement"
  | "validation-improvement"
  | "recovery"
  | "repair"
  | "recommendation"
  | "search"
  | "error";

export interface ImageGenerationOptimizationLogEntry {
  timestamp: string;
  level: ImageGenerationOptimizationLogLevel;
  event: ImageGenerationOptimizationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
