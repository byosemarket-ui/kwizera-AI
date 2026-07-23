export type AudioQualityValidationLogLevel = "info" | "warn" | "error" | "debug";
export type AudioQualityValidationLogEvent = "startup" | "validation" | "repair" | "recommendation" | "search" | "performance" | "error";
export interface AudioQualityValidationLogEntry {
    timestamp: string;
    level: AudioQualityValidationLogLevel;
    event: AudioQualityValidationLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=audio-quality-validation-log-types.d.ts.map