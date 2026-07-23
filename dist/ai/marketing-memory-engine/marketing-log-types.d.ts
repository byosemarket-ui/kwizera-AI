export type MarketingMemoryLogLevel = "debug" | "info" | "warn" | "error";
export type MarketingMemoryLogEvent = "startup" | "shutdown" | "campaign-create" | "campaign-update" | "campaign-complete" | "pattern-detection" | "relationship" | "learning" | "customer" | "search" | "performance" | "warning" | "error";
export interface MarketingMemoryLogEntry {
    timestamp: string;
    level: MarketingMemoryLogLevel;
    event: MarketingMemoryLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=marketing-log-types.d.ts.map