export type KnowledgeRetrievalLogLevel = "debug" | "info" | "warn" | "error";
export type KnowledgeRetrievalLogEvent = "startup" | "shutdown" | "search" | "retrieve" | "ranking" | "cache" | "validation" | "related" | "recommendation" | "performance" | "warning" | "error";
export interface KnowledgeRetrievalLogEntry {
    timestamp: string;
    level: KnowledgeRetrievalLogLevel;
    event: KnowledgeRetrievalLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=retrieval-log-types.d.ts.map