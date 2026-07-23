/**
 * KWIZERA AI STUDIO — Image-to-Image Generation Engine log types (Step 9C)
 */

export type ImageToImageGenerationLogLevel = "debug" | "info" | "warn" | "error";

export type ImageToImageGenerationLogEvent =
  | "startup"
  | "image-analysis"
  | "transformation-planning"
  | "mask-creation"
  | "preservation"
  | "background-planning"
  | "validation"
  | "recommendation"
  | "relationship"
  | "search"
  | "repair"
  | "performance"
  | "platform-optimization"
  | "variation";

export interface ImageToImageGenerationLogEntry {
  timestamp: string;
  level: ImageToImageGenerationLogLevel;
  event: ImageToImageGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
