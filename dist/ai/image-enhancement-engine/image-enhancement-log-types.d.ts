export type ImageEnhancementLogLevel = "debug" | "info" | "warn" | "error";
export type ImageEnhancementLogEvent = "startup" | "image-analysis" | "enhancement-operation" | "restoration-operation" | "print-preparation" | "super-resolution" | "preservation" | "validation" | "recommendation" | "relationship" | "search" | "repair" | "performance";
export interface ImageEnhancementLogEntry {
    timestamp: string;
    level: ImageEnhancementLogLevel;
    event: ImageEnhancementLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=image-enhancement-log-types.d.ts.map