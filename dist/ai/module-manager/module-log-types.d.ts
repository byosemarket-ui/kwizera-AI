export type ModuleManagerLogLevel = "debug" | "info" | "warn" | "error";
export type ModuleManagerLogEvent = "registration" | "initialization" | "loading" | "state-change" | "communication" | "health" | "recovery" | "performance" | "warning" | "error";
export interface ModuleManagerLogEntry {
    timestamp: string;
    level: ModuleManagerLogLevel;
    event: ModuleManagerLogEvent;
    message: string;
    data?: Record<string, unknown>;
}
//# sourceMappingURL=module-log-types.d.ts.map