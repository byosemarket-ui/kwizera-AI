export type MemoryRetrievalLogLevel = "debug" | "info" | "warn" | "error";
export type MemoryRetrievalLogEvent = "startup" | "shutdown" | "search" | "retrieve" | "ranking" | "cache" | "validation" | "related" | "performance" | "warning" | "error";
export interface MemoryRetrievalLogEntry {
    timestamp: string;
    level: MemoryRetrievalLogLevel;
    event: MemoryRetrievalLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=retrieval-log-types.d.ts.map