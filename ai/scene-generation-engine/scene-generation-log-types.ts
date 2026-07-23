/**
 * KWIZERA AI STUDIO — Scene Generation Engine log types (Step 8C)
 */

export type SceneGenerationLogLevel = "debug" | "info" | "warn" | "error";

export type SceneGenerationLogEvent =
  | "startup"
  | "generation"
  | "shot-planning"
  | "composition"
  | "validation"
  | "relationship"
  | "search"
  | "repair"
  | "recommendation"
  | "performance";

export interface SceneGenerationLogEntry {
  timestamp: string;
  level: SceneGenerationLogLevel;
  event: SceneGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
