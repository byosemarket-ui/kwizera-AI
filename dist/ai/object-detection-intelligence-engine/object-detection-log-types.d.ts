export type ObjectDetectionLogLevel = "debug" | "info" | "warn" | "error";
export type ObjectDetectionLogEvent = "startup" | "shutdown" | "detection" | "relationship" | "validation" | "recommendation" | "search" | "performance" | "warning" | "error";
export interface ObjectDetectionLogEntry {
    timestamp: string;
    level: ObjectDetectionLogLevel;
    event: ObjectDetectionLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=object-detection-log-types.d.ts.map