/**
 * KWIZERA AI STUDIO — Animation Generation Engine log types (Step 8F)
 */

export type AnimationGenerationLogLevel = "debug" | "info" | "warn" | "error";

export type AnimationGenerationLogEvent =
  | "startup"
  | "planning"
  | "decision"
  | "synchronization"
  | "validation"
  | "relationship"
  | "search"
  | "repair"
  | "recommendation"
  | "performance";

export interface AnimationGenerationLogEntry {
  timestamp: string;
  level: AnimationGenerationLogLevel;
  event: AnimationGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
