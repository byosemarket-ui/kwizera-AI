export type AudioMixingMasteringLogLevel = "info" | "warn" | "error" | "debug";
export type AudioMixingMasteringLogEvent = "startup" | "shutdown" | "track-analysis" | "mixing-planning" | "mastering-planning" | "loudness-planning" | "frequency-planning" | "spatial-planning" | "blueprint-generation" | "validation" | "recommendation" | "search" | "repair" | "performance" | "error";
export interface AudioMixingMasteringLogEntry {
    timestamp: string;
    level: AudioMixingMasteringLogLevel;
    event: AudioMixingMasteringLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=audio-mixing-mastering-log-types.d.ts.map