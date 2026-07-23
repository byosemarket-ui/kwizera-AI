export type AudioPlanningLogLevel = "debug" | "info" | "warn" | "error";
export type AudioPlanningLogEvent = "startup" | "shutdown" | "audio-planning" | "synchronization" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "warning" | "error";
export interface AudioPlanningLogEntry {
    timestamp: string;
    level: AudioPlanningLogLevel;
    event: AudioPlanningLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=audio-planning-log-types.d.ts.map