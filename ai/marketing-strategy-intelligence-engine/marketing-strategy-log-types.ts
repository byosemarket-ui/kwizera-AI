export type MarketingStrategyLogLevel = "debug" | "info" | "warn" | "error";

export type MarketingStrategyLogEvent =
  | "startup"
  | "shutdown"
  | "strategy-analysis"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "warning"
  | "error";

export interface MarketingStrategyLogEntry {
  timestamp: string;
  level: MarketingStrategyLogLevel;
  event: MarketingStrategyLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
