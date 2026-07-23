export type MusicGenerationLogLevel = "info" | "warn" | "error" | "debug";

export type MusicGenerationLogEvent =
  | "startup"
  | "shutdown"
  | "music-analysis"
  | "composition-planning"
  | "arrangement-planning"
  | "mood-planning"
  | "sync-planning"
  | "loop-planning"
  | "blueprint-generation"
  | "validation"
  | "recommendation"
  | "search"
  | "repair"
  | "performance"
  | "error";

export interface MusicGenerationLogEntry {
  timestamp: string;
  level: MusicGenerationLogLevel;
  event: MusicGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
