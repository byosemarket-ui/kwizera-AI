export type TextToSpeechGenerationLogLevel = "info" | "warn" | "error" | "debug";
export type TextToSpeechGenerationLogEvent = "startup" | "shutdown" | "text-analysis" | "pronunciation-planning" | "emotion-planning" | "naturalness-planning" | "blueprint-generation" | "validation" | "recommendation" | "search" | "repair" | "performance" | "error";
export interface TextToSpeechGenerationLogEntry {
    timestamp: string;
    level: TextToSpeechGenerationLogLevel;
    event: TextToSpeechGenerationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=text-to-speech-generation-log-types.d.ts.map