export type VideoUnderstandingLogLevel = "debug" | "info" | "warn" | "error";
export type VideoUnderstandingLogEvent = "startup" | "shutdown" | "understanding" | "story" | "scene" | "relationship" | "validation" | "recommendation" | "search" | "graph" | "performance" | "warning" | "error";
export interface VideoUnderstandingLogEntry {
    timestamp: string;
    level: VideoUnderstandingLogLevel;
    event: VideoUnderstandingLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=video-understanding-log-types.d.ts.map