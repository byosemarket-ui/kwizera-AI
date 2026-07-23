export type CreativeVideoLogLevel = "debug" | "info" | "warn" | "error";
export type CreativeVideoLogEvent = "startup" | "shutdown" | "planning" | "storyboard" | "recommendation" | "relationship" | "validation" | "search" | "performance" | "warning" | "error";
export interface CreativeVideoLogEntry {
    timestamp: string;
    level: CreativeVideoLogLevel;
    event: CreativeVideoLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=creative-video-log-types.d.ts.map