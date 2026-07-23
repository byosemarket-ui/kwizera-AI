export type ProjectMemoryLogLevel = "debug" | "info" | "warn" | "error";
export type ProjectMemoryLogEvent = "startup" | "shutdown" | "project-create" | "project-update" | "version-create" | "checkpoint" | "recovery" | "validation" | "relationship" | "performance" | "warning" | "error";
export interface ProjectMemoryLogEntry {
    timestamp: string;
    level: ProjectMemoryLogLevel;
    event: ProjectMemoryLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=project-log-types.d.ts.map