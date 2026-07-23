/**
 * KWIZERA AI STUDIO — AI Recovery Engine types (Step 2J)
 */
export var FailureType;
(function (FailureType) {
    FailureType["Application"] = "application";
    FailureType["Module"] = "module";
    FailureType["Workflow"] = "workflow";
    FailureType["Task"] = "task";
    FailureType["Database"] = "database";
    FailureType["Storage"] = "storage";
    FailureType["Communication"] = "communication";
    FailureType["Startup"] = "startup";
    FailureType["Shutdown"] = "shutdown";
    FailureType["UnexpectedShutdown"] = "unexpected-shutdown";
    FailureType["Configuration"] = "configuration";
    FailureType["Session"] = "session";
})(FailureType || (FailureType = {}));
export var RecoveryType;
(function (RecoveryType) {
    RecoveryType["Application"] = "application-recovery";
    RecoveryType["Module"] = "module-recovery";
    RecoveryType["Workflow"] = "workflow-recovery";
    RecoveryType["Task"] = "task-recovery";
    RecoveryType["Project"] = "project-recovery";
    RecoveryType["Database"] = "database-recovery";
    RecoveryType["Storage"] = "storage-recovery";
    RecoveryType["Memory"] = "memory-recovery";
    RecoveryType["Communication"] = "communication-recovery";
    RecoveryType["Configuration"] = "configuration-recovery";
    RecoveryType["Session"] = "session-recovery";
    RecoveryType["Video"] = "video-recovery";
})(RecoveryType || (RecoveryType = {}));
export var RecoveryResultStatus;
(function (RecoveryResultStatus) {
    RecoveryResultStatus["Success"] = "success";
    RecoveryResultStatus["Partial"] = "partial";
    RecoveryResultStatus["Failed"] = "failed";
    RecoveryResultStatus["Skipped"] = "skipped";
})(RecoveryResultStatus || (RecoveryResultStatus = {}));
export var MonitoredComponent;
(function (MonitoredComponent) {
    MonitoredComponent["Application"] = "application";
    MonitoredComponent["AiCore"] = "ai-core";
    MonitoredComponent["ModuleManager"] = "module-manager";
    MonitoredComponent["WorkflowEngine"] = "workflow-engine";
    MonitoredComponent["TaskManager"] = "task-manager";
    MonitoredComponent["CommunicationBus"] = "communication-bus";
    MonitoredComponent["StateManager"] = "state-manager";
    MonitoredComponent["Database"] = "database";
    MonitoredComponent["Storage"] = "storage";
    MonitoredComponent["Logs"] = "logs";
    MonitoredComponent["Configuration"] = "configuration";
})(MonitoredComponent || (MonitoredComponent = {}));
export class RecoveryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "RecoveryEngineError";
    }
}
export const RECOVERY_SEQUENCE = [
    "detect-failure",
    "identify-component",
    "determine-root-cause",
    "protect-user-data",
    "save-diagnostics",
    "create-recovery-plan",
    "restore-latest-valid-state",
    "restart-affected-component",
    "validate-recovery",
    "resume-unfinished-work",
    "notify-ai-core",
    "log-complete-recovery",
];
export const PROTECTED_MEMORY_CATEGORIES = [
    "learning-history",
    "persistent-memory",
    "knowledge",
    "marketing-memory",
    "video-memory",
    "reasoning-history",
    "decision-history",
    "system-history",
];
//# sourceMappingURL=types.js.map