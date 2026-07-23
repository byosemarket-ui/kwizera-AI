export type ImageQualityValidationLogLevel = "info" | "warn" | "error" | "debug";
export type ImageQualityValidationLogEvent = "startup" | "validation" | "repair" | "recommendation" | "search" | "performance" | "error";
export interface ImageQualityValidationLogEntry {
    timestamp: string;
    level: ImageQualityValidationLogLevel;
    event: ImageQualityValidationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=image-quality-validation-log-types.d.ts.map