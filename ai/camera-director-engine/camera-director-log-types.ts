/**
 * KWIZERA AI STUDIO — Camera Director Engine log types (Step 8D)
 */

export type CameraDirectorLogLevel = "debug" | "info" | "warn" | "error";

export type CameraDirectorLogEvent =
  | "startup"
  | "planning"
  | "decision"
  | "composition"
  | "validation"
  | "relationship"
  | "search"
  | "repair"
  | "recommendation"
  | "performance";

export interface CameraDirectorLogEntry {
  timestamp: string;
  level: CameraDirectorLogLevel;
  event: CameraDirectorLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
