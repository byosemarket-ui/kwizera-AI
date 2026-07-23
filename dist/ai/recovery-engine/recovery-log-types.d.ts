export type RecoveryEngineLogLevel = "debug" | "info" | "warn" | "error";
export type RecoveryEngineLogEvent = "failure" | "warning" | "recovery-attempt" | "recovery-success" | "recovery-failure" | "diagnostics" | "performance";
export interface RecoveryEngineLogEntry {
    timestamp: string;
    level: RecoveryEngineLogLevel;
    event: RecoveryEngineLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=recovery-log-types.d.ts.map