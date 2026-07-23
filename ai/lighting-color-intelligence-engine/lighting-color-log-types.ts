export type LightingColorLogLevel = "debug" | "info" | "warn" | "error";

export type LightingColorLogEvent =
  | "startup"
  | "lighting"
  | "color"
  | "relationship"
  | "validation"
  | "recommendation"
  | "search"
  | "performance"
  | "error";

export interface LightingColorLogEntry {
  timestamp: string;
  level: LightingColorLogLevel;
  event: LightingColorLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
