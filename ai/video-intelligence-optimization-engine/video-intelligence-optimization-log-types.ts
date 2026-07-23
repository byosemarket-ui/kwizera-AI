export type VideoIntelligenceOptimizationLogLevel = "debug" | "info" | "warn" | "error";



export type VideoIntelligenceOptimizationLogEvent =

  | "startup"

  | "shutdown"

  | "optimization"

  | "recovery"

  | "performance"

  | "workflow"

  | "recommendation"

  | "cache"

  | "validation"

  | "search"

  | "warning"

  | "error";



export interface VideoIntelligenceOptimizationLogEntry {

  timestamp: string;

  level: VideoIntelligenceOptimizationLogLevel;

  event: VideoIntelligenceOptimizationLogEvent;

  message: string;

  data?: Record<string, unknown>;

}


