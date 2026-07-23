/**
 * KWIZERA AI STUDIO — Motion Generation Engine log types (Step 8E)
 */

export type MotionGenerationLogLevel = "debug" | "info" | "warn" | "error";

export type MotionGenerationLogEvent =
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

export interface MotionGenerationLogEntry {
  timestamp: string;
  level: MotionGenerationLogLevel;
  event: MotionGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
