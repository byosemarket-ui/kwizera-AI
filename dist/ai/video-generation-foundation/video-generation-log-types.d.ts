export type VideoGenerationFoundationLogLevel = "debug" | "info" | "warn" | "error";
export type VideoGenerationFoundationLogEvent = "startup" | "shutdown" | "registration" | "blueprint" | "lifecycle" | "validation" | "health" | "integration" | "asset" | "project" | "workflow" | "recovery" | "performance" | "error";
export interface VideoGenerationFoundationLogEntry {
    timestamp: string;
    level: VideoGenerationFoundationLogLevel;
    event: VideoGenerationFoundationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=video-generation-log-types.d.ts.map