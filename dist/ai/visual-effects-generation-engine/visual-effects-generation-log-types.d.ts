/**
 * KWIZERA AI STUDIO — Visual Effects Generation Engine log types (Step 8G)
 */
export type VisualEffectsGenerationLogLevel = "debug" | "info" | "warn" | "error";
export type VisualEffectsGenerationLogEvent = "startup" | "planning" | "decision" | "synchronization" | "validation" | "relationship" | "search" | "repair" | "recommendation" | "performance";
export interface VisualEffectsGenerationLogEntry {
    timestamp: string;
    level: VisualEffectsGenerationLogLevel;
    event: VisualEffectsGenerationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=visual-effects-generation-log-types.d.ts.map