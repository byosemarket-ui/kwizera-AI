export type SceneDetectionLogLevel = "debug" | "info" | "warn" | "error";
export type SceneDetectionLogEvent = "startup" | "shutdown" | "scene" | "shot" | "transition" | "relationship" | "validation" | "recommendation" | "indexing" | "search" | "performance" | "warning" | "error";
export interface SceneDetectionLogEntry {
    timestamp: string;
    level: SceneDetectionLogLevel;
    event: SceneDetectionLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=scene-detection-log-types.d.ts.map