export type SpeechToSpeechGenerationLogLevel = "info" | "warn" | "error" | "debug";

export type SpeechToSpeechGenerationLogEvent =
  | "startup"
  | "shutdown"
  | "speech-analysis"
  | "voice-transformation"
  | "emotion-planning"
  | "timing-planning"
  | "blueprint-generation"
  | "validation"
  | "recommendation"
  | "search"
  | "repair"
  | "performance"
  | "error";

export interface SpeechToSpeechGenerationLogEntry {
  timestamp: string;
  level: SpeechToSpeechGenerationLogLevel;
  event: SpeechToSpeechGenerationLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
