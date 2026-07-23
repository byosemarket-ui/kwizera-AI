export type MemoryStorageLogLevel = "debug" | "info" | "warn" | "error";
export type MemoryStorageLogEvent = "startup" | "shutdown" | "create" | "update" | "validation" | "duplicate" | "integrity" | "version" | "performance" | "warning" | "error";
export interface MemoryStorageLogEntry {
    timestamp: string;
    level: MemoryStorageLogLevel;
    event: MemoryStorageLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=storage-log-types.d.ts.map