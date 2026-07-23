export type ProductIntelligenceHealthMonitorLogLevel = "info" | "warn" | "error";

export type ProductIntelligenceHealthMonitorLogEvent =
  | "startup"
  | "health-check"
  | "audit"
  | "warning"
  | "repair"
  | "performance"
  | "trend"
  | "simulation";

export interface ProductIntelligenceHealthMonitorLogEntry {
  timestamp: string;
  level: ProductIntelligenceHealthMonitorLogLevel;
  event: ProductIntelligenceHealthMonitorLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
