export type VoiceCloningGenerationLogLevel = "info" | "warn" | "error" | "debug";

export type VoiceCloningGenerationLogEvent =
  | "startup"
  | "shutdown"
  | "voice-analysis"
  | "authorization-validation"
  | "profile-creation"
  | "cloning-planning"
  | "blueprint-generation"
  | "validation"
  | "recommendation"
  | "search"
  | "repair"
  | "performance"
  | "error";

export interface VoiceCloningGenerationLogEntry {
  timestamp: string;
  level: VoiceCloningGenerationLogLevel;
  event: VoiceCloningGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
