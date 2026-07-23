import { ManagedModuleState, ModuleHealthStatus, } from "./types.js";
export class ModuleRecoveryManager {
    history;
    logger;
    router;
    diagnostics = [];
    restartCounts = new Map();
    constructor(history, logger, router) {
        this.history = history;
        this.logger = logger;
        this.router = router;
    }
    getDiagnostics() {
        return this.diagnostics;
    }
    getRestartCount(moduleId) {
        return this.restartCounts.get(moduleId) ?? 0;
    }
    async recover(record, plugin, reinitialize) {
        const steps = [];
        record.status = ManagedModuleState.Recovering;
        steps.push("Failure detected");
        steps.push("Diagnostics generated");
        const diag = {
            moduleId: record.moduleId,
            failureReason: record.lastError ?? "Unknown failure",
            timestamp: new Date().toISOString(),
            steps,
        };
        this.logger.log("warn", "recovery", `Recovering module ${record.moduleId}`, {
            failureReason: record.lastError,
        });
        try {
            record.status = ManagedModuleState.Restarting;
            steps.push("Restarting affected module only");
            this.router.isolate(record.moduleId);
            await plugin.shutdown();
            steps.push("Module shutdown complete");
            record.status = ManagedModuleState.Stopped;
            await reinitialize();
            steps.push("Dependencies reconnected");
            steps.push("Normal operation resumed");
            record.status = ManagedModuleState.Running;
            record.healthStatus = ModuleHealthStatus.Healthy;
            record.lastError = undefined;
            this.router.clearIsolation(record.moduleId);
            const count = (this.restartCounts.get(record.moduleId) ?? 0) + 1;
            this.restartCounts.set(record.moduleId, count);
            this.history.appendEvent({
                moduleId: record.moduleId,
                eventType: "recovery",
                detail: steps.join(" → "),
                timestamp: new Date().toISOString(),
            });
            diag.steps = steps;
            this.diagnostics.push(diag);
            this.logger.log("info", "recovery", `Module ${record.moduleId} recovered`, { count });
            return true;
        }
        catch (error) {
            record.status = ManagedModuleState.Failed;
            record.healthStatus = ModuleHealthStatus.Unhealthy;
            record.lastError = error instanceof Error ? error.message : String(error);
            steps.push(`Recovery failed: ${record.lastError}`);
            diag.steps = steps;
            this.diagnostics.push(diag);
            this.logger.log("error", "recovery", `Recovery failed for ${record.moduleId}`, {
                error: record.lastError,
            });
            return false;
        }
    }
}
//# sourceMappingURL=module-recovery-manager.js.map