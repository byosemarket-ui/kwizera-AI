export type KnowledgeGraphLogLevel = "debug" | "info" | "warn" | "error";
export type KnowledgeGraphLogEvent = "startup" | "shutdown" | "node" | "relationship" | "discovery" | "integrity" | "optimization" | "search" | "traversal" | "recommendation" | "evolution" | "performance" | "warning" | "error";
export interface KnowledgeGraphLogEntry {
    timestamp: string;
    level: KnowledgeGraphLogLevel;
    event: KnowledgeGraphLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=graph-log-types.d.ts.map