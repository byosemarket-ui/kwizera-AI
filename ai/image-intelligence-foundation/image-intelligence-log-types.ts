export type ImageIntelligenceFoundationLogLevel = "debug" | "info" | "warn" | "error";

export type ImageIntelligenceFoundationLogEvent =
  | "startup"
  | "shutdown"
  | "registration"
  | "access"
  | "validation"
  | "integrity"
  | "health"
  | "integration"
  | "recovery"
  | "lifecycle"
  | "performance"
  | "warning"
  | "error";

export interface ImageIntelligenceFoundationLogEntry {
  timestamp: string;
  level: ImageIntelligenceFoundationLogLevel;
  event: ImageIntelligenceFoundationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
