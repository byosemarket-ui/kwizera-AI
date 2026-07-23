export type LearningMemoryLogLevel = "debug" | "info" | "warn" | "error";
export type LearningMemoryLogEvent = "startup" | "shutdown" | "learning-event" | "preference-update" | "correction" | "pattern" | "self-improvement" | "performance" | "warning" | "error";
export interface LearningMemoryLogEntry {
    timestamp: string;
    level: LearningMemoryLogLevel;
    event: LearningMemoryLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=learning-log-types.d.ts.map