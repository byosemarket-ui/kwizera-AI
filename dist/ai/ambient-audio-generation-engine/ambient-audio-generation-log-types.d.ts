export type AmbientAudioGenerationLogLevel = "info" | "warn" | "error" | "debug";
export type AmbientAudioGenerationLogEvent = "startup" | "shutdown" | "environment-analysis" | "ambient-planning" | "weather-planning" | "spatial-planning" | "timeline-planning" | "sync-planning" | "blueprint-generation" | "validation" | "recommendation" | "search" | "repair" | "performance" | "error";
export interface AmbientAudioGenerationLogEntry {
    timestamp: string;
    level: AmbientAudioGenerationLogLevel;
    event: AmbientAudioGenerationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=ambient-audio-generation-log-types.d.ts.map