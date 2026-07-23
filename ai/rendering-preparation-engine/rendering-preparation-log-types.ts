/**
 * KWIZERA AI STUDIO — Rendering Preparation Engine log types (Step 8K)
 */

export type RenderingPreparationLogLevel = "debug" | "info" | "warn" | "error";

export type RenderingPreparationLogEvent =
  | "startup"
  | "preparation"
  | "validation"
  | "resource"
  | "queue"
  | "recovery"
  | "timeline"
  | "asset"
  | "relationship"
  | "search"
  | "repair"
  | "recommendation"
  | "performance";

export interface RenderingPreparationLogEntry {
  timestamp: string;
  level: RenderingPreparationLogLevel;
  event: RenderingPreparationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
