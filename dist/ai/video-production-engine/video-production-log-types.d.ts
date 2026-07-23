/**
 * KWIZERA AI STUDIO — Video Production Engine log types (Step 8J)
 */
export type VideoProductionLogLevel = "debug" | "info" | "warn" | "error";
export type VideoProductionLogEvent = "startup" | "planning" | "workflow" | "asset" | "timeline" | "dependency" | "decision" | "validation" | "relationship" | "search" | "repair" | "recommendation" | "performance";
export interface VideoProductionLogEntry {
    timestamp: string;
    level: VideoProductionLogLevel;
    event: VideoProductionLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=video-production-log-types.d.ts.map