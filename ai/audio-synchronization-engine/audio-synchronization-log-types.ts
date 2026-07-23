/**
 * KWIZERA AI STUDIO — Audio Synchronization Engine log types (Step 8H)
 */

export type AudioSynchronizationLogLevel = "debug" | "info" | "warn" | "error";

export type AudioSynchronizationLogEvent =
  | "startup"
  | "synchronization"
  | "voice"
  | "music"
  | "subtitle"
  | "decision"
  | "validation"
  | "relationship"
  | "search"
  | "repair"
  | "recommendation"
  | "performance";

export interface AudioSynchronizationLogEntry {
  timestamp: string;
  level: AudioSynchronizationLogLevel;
  event: AudioSynchronizationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
