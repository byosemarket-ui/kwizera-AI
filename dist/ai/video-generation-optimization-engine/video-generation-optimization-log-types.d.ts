/**
 * KWIZERA AI STUDIO — Video Generation Optimization Engine log types (Step 8M)
 */
export type VideoGenerationOptimizationLogLevel = "debug" | "info" | "warn" | "error";
export type VideoGenerationOptimizationLogEvent = "startup" | "optimization" | "resource" | "performance" | "quality" | "search" | "recovery" | "validation" | "relationship" | "search-query" | "repair" | "recommendation";
export interface VideoGenerationOptimizationLogEntry {
    timestamp: string;
    level: VideoGenerationOptimizationLogLevel;
    event: VideoGenerationOptimizationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=video-generation-optimization-log-types.d.ts.map