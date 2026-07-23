export type VideoStyleLogLevel = "debug" | "info" | "warn" | "error";
export type VideoStyleLogEvent = "startup" | "shutdown" | "analysis" | "classification" | "template" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "warning" | "error";
export interface VideoStyleLogEntry {
    timestamp: string;
    level: VideoStyleLogLevel;
    event: VideoStyleLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=video-style-log-types.d.ts.map