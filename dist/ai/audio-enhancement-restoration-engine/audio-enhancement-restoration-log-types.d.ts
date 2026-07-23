export type AudioEnhancementRestorationLogLevel = "info" | "warn" | "error" | "debug";
export type AudioEnhancementRestorationLogEvent = "startup" | "shutdown" | "audio-analysis" | "enhancement-planning" | "restoration-planning" | "voice-improvement" | "music-improvement" | "sync-planning" | "blueprint-generation" | "validation" | "recommendation" | "search" | "repair" | "performance" | "error";
export interface AudioEnhancementRestorationLogEntry {
    timestamp: string;
    level: AudioEnhancementRestorationLogLevel;
    event: AudioEnhancementRestorationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=audio-enhancement-restoration-log-types.d.ts.map