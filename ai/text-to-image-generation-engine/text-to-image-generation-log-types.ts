/**
 * KWIZERA AI STUDIO — Text-to-Image Generation Engine log types (Step 9B)
 */

export type TextToImageGenerationLogLevel = "debug" | "info" | "warn" | "error";

export type TextToImageGenerationLogEvent =
  | "startup"
  | "prompt-analysis"
  | "blueprint-generation"
  | "composition-planning"
  | "lighting-planning"
  | "style-planning"
  | "color-planning"
  | "validation"
  | "recommendation"
  | "relationship"
  | "search"
  | "repair"
  | "performance"
  | "platform-optimization"
  | "variation";

export interface TextToImageGenerationLogEntry {
  timestamp: string;
  level: TextToImageGenerationLogLevel;
  event: TextToImageGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
