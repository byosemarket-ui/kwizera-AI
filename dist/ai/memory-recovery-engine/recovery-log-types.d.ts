export type MemoryRecoveryLogLevel = "debug" | "info" | "warn" | "error";
export type MemoryRecoveryLogEvent = "startup" | "shutdown" | "request" | "validation" | "recovery" | "partial" | "integrity" | "auto-recovery" | "snapshot" | "performance" | "warning" | "error";
export interface MemoryRecoveryLogEntry {
    timestamp: string;
    level: MemoryRecoveryLogLevel;
    event: MemoryRecoveryLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=recovery-log-types.d.ts.map