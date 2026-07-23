import fs from "node:fs";
import { FailureType, MonitoredComponent } from "./types.js";
let failureCounter = 0;
export class FailureDetector {
    deps;
    logger;
    detectedFailures = [];
    constructor(deps, logger) {
        this.deps = deps;
        this.logger = logger;
    }
    async scanAll() {
        const failures = [];
        failures.push(...this.checkApplication());
        failures.push(...this.checkAiCore());
        failures.push(...this.checkModuleManager());
        failures.push(...this.checkWorkflowEngine());
        failures.push(...this.checkTaskManager());
        failures.push(...this.checkCommunicationBus());
        failures.push(...this.checkStateManager());
        failures.push(...this.checkStorage());
        failures.push(...this.checkConfiguration());
        failures.push(...this.checkUnexpectedShutdown());
        for (const failure of failures) {
            this.detectedFailures.push(failure);
            this.logger.log("warn", "failure", `Failure detected: ${failure.failureType}`, {
                failureId: failure.failureId,
                component: failure.affectedComponent,
                rootCause: failure.rootCause,
            });
        }
        return failures;
    }
    getDetectedFailures() {
        return this.detectedFailures;
    }
    checkApplication() {
        const state = this.deps.getStateManager()?.getApplicationState();
        if (state === "recovering") {
            return [this.createReport(FailureType.Application, MonitoredComponent.Application, "Application in recovery state", "high")];
        }
        return [];
    }
    checkAiCore() {
        const core = this.deps.getCore();
        if (!core.isStarted()) {
            return [this.createReport(FailureType.Startup, MonitoredComponent.AiCore, "AI Core not started", "critical")];
        }
        const lifecycle = core.getLifecycleState();
        if (lifecycle === "failed") {
            return [this.createReport(FailureType.Application, MonitoredComponent.AiCore, "AI Core lifecycle failed", "critical")];
        }
        return [];
    }
    checkModuleManager() {
        const manager = this.deps.getModuleManager();
        if (!manager?.isInitialized()) {
            return [this.createReport(FailureType.Module, MonitoredComponent.ModuleManager, "Module Manager not initialized", "high")];
        }
        const report = manager.buildStatusReport();
        if (report.knownIssues.length > 0) {
            return report.knownIssues.map((issue) => this.createReport(FailureType.Module, MonitoredComponent.ModuleManager, issue, "medium"));
        }
        return [];
    }
    checkWorkflowEngine() {
        const engine = this.deps.getCore().workflowEngine;
        if (!engine?.isInitialized())
            return [];
        const workflows = this.deps.getStateManager()?.getCurrentSnapshot().workflows ?? {};
        const failed = Object.entries(workflows).filter(([, w]) => w.state === "failed");
        return failed.map(([id]) => this.createReport(FailureType.Workflow, MonitoredComponent.WorkflowEngine, `Workflow ${id} failed`, "high", { workflowId: id }));
    }
    checkTaskManager() {
        const tasks = this.deps.getStateManager()?.getCurrentSnapshot().tasks ?? {};
        const failed = Object.entries(tasks).filter(([, t]) => t.state === "failed");
        return failed.map(([id]) => this.createReport(FailureType.Task, MonitoredComponent.TaskManager, `Task ${id} failed`, "medium", { taskId: id }));
    }
    checkCommunicationBus() {
        const bus = this.deps.getCommunicationBus();
        if (!bus?.isInitialized())
            return [];
        const failures = bus.getValidationFailures();
        if (failures.length > 0) {
            return [this.createReport(FailureType.Communication, MonitoredComponent.CommunicationBus, `${failures.length} communication rejection(s)`, "low")];
        }
        return [];
    }
    checkStateManager() {
        const state = this.deps.getStateManager();
        if (!state?.isInitialized()) {
            return [this.createReport(FailureType.Application, MonitoredComponent.StateManager, "State Manager not initialized", "high")];
        }
        const recoveryMsg = state.getLastRecoveryMessage();
        if (recoveryMsg) {
            return [this.createReport(FailureType.UnexpectedShutdown, MonitoredComponent.StateManager, recoveryMsg, "high")];
        }
        return [];
    }
    checkStorage() {
        if (!fs.existsSync(this.deps.storageRoot)) {
            return [this.createReport(FailureType.Storage, MonitoredComponent.Storage, "Storage root missing", "critical")];
        }
        return [];
    }
    checkConfiguration() {
        if (!this.deps.getCore().configuration.isLoaded()) {
            return [this.createReport(FailureType.Configuration, MonitoredComponent.Configuration, "Configuration not loaded", "high")];
        }
        return [];
    }
    checkUnexpectedShutdown() {
        const snapshot = this.deps.getStateManager()?.snapshots.loadLatestSnapshot();
        if (snapshot && !snapshot.cleanShutdown) {
            return [this.createReport(FailureType.UnexpectedShutdown, MonitoredComponent.Application, "Unclean shutdown detected", "critical", { snapshotId: snapshot.snapshotId })];
        }
        return [];
    }
    createReport(type, component, rootCause, severity, diagnostics = {}) {
        return {
            failureId: `fail-${++failureCounter}-${Date.now()}`,
            failureType: type,
            affectedComponent: component,
            rootCause,
            timestamp: new Date().toISOString(),
            severity,
            diagnostics,
        };
    }
}
//# sourceMappingURL=failure-detector.js.map