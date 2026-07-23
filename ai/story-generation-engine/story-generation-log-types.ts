/**
 * KWIZERA AI STUDIO — Storyboard Generation Engine log types (Step 8B)
 */

export type StoryGenerationLogLevel = "debug" | "info" | "warn" | "error";

export type StoryGenerationLogEvent =
  | "startup"
  | "generation"
  | "scene-planning"
  | "shot-planning"
  | "validation"
  | "recommendation"
  | "relationship"
  | "search"
  | "repair"
  | "performance"
  | "platform-variation";

export interface StoryGenerationLogEntry {
  timestamp: string;
  level: StoryGenerationLogLevel;
  event: StoryGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
