/**
 * KWIZERA AI STUDIO — Video Analysis Engine log types (Step 7B)
 */

export type VideoAnalysisLogLevel = "debug" | "info" | "warn" | "error";

export type VideoAnalysisLogEvent =
  | "startup"
  | "analysis"
  | "timeline"
  | "audio"
  | "frame"
  | "classification"
  | "indexing"
  | "relationship"
  | "validation"
  | "search"
  | "performance"
  | "error";

export interface VideoAnalysisLogEntry {
  timestamp: string;
  level: VideoAnalysisLogLevel;
  event: VideoAnalysisLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
