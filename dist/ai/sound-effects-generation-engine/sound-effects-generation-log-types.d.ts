export type SoundEffectsGenerationLogLevel = "info" | "warn" | "error" | "debug";
export type SoundEffectsGenerationLogEvent = "startup" | "shutdown" | "sound-analysis" | "sound-planning" | "foley-planning" | "environmental-planning" | "cinematic-planning" | "timeline-planning" | "sync-planning" | "blueprint-generation" | "validation" | "recommendation" | "search" | "repair" | "performance" | "error";
export interface SoundEffectsGenerationLogEntry {
    timestamp: string;
    level: SoundEffectsGenerationLogLevel;
    event: SoundEffectsGenerationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=sound-effects-generation-log-types.d.ts.map