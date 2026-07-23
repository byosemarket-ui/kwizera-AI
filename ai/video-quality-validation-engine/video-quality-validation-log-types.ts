/**
 * KWIZERA AI STUDIO — Video Quality Validation Engine log types (Step 8L)
 */

export type VideoQualityValidationLogLevel = "debug" | "info" | "warn" | "error";

export type VideoQualityValidationLogEvent =
  | "startup"
  | "validation"
  | "repair"
  | "recommendation"
  | "relationship"
  | "search"
  | "performance"
  | "visual"
  | "audio"
  | "brand"
  | "technical";

export interface VideoQualityValidationLogEntry {
  timestamp: string;
  level: VideoQualityValidationLogLevel;
  event: VideoQualityValidationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
