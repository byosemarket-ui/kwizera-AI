export type RelationshipMemoryLogLevel = "debug" | "info" | "warn" | "error";
export type RelationshipMemoryLogEvent = "startup" | "shutdown" | "create" | "update" | "remove" | "discovery" | "integrity" | "optimization" | "recommendation" | "performance" | "warning" | "error";
export interface RelationshipMemoryLogEntry {
    timestamp: string;
    level: RelationshipMemoryLogLevel;
    event: RelationshipMemoryLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=relationship-log-types.d.ts.map