export type VideoQualityPredictionLogLevel = "debug" | "info" | "warn" | "error";
export type VideoQualityPredictionLogEvent = "startup" | "shutdown" | "quality" | "prediction" | "risk" | "recommendation" | "relationship" | "validation" | "search" | "performance" | "warning" | "error";
export interface VideoQualityPredictionLogEntry {
    timestamp: string;
    level: VideoQualityPredictionLogLevel;
    event: VideoQualityPredictionLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=video-quality-prediction-log-types.d.ts.map