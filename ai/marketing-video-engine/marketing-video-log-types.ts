/**
 * KWIZERA AI STUDIO — Marketing Video Engine log types (Step 8I)
 */

export type MarketingVideoLogLevel = "debug" | "info" | "warn" | "error";

export type MarketingVideoLogEvent =
  | "startup"
  | "planning"
  | "hook"
  | "cta"
  | "engagement"
  | "decision"
  | "validation"
  | "relationship"
  | "search"
  | "repair"
  | "recommendation"
  | "performance";

export interface MarketingVideoLogEntry {
  timestamp: string;
  level: MarketingVideoLogLevel;
  event: MarketingVideoLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
