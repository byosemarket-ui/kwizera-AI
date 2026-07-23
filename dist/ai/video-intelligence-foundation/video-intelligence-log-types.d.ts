/**
 * KWIZERA AI STUDIO — Video Intelligence Foundation log types (Step 7A)
 */
export type VideoIntelligenceFoundationLogLevel = "debug" | "info" | "warn" | "error";
export type VideoIntelligenceFoundationLogEvent = "startup" | "shutdown" | "registration" | "access" | "validation" | "integrity" | "health" | "recovery" | "integration" | "asset" | "indexing" | "workflow" | "project" | "performance" | "error";
export interface VideoIntelligenceFoundationLogEntry {
    timestamp: string;
    level: VideoIntelligenceFoundationLogLevel;
    event: VideoIntelligenceFoundationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=video-intelligence-log-types.d.ts.map