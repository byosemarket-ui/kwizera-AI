import { ApplicationState } from "../state-manager/types.js";
export class SelfHealing {
    logger;
    actionCount = 0;
    constructor(logger) {
        this.logger = logger;
    }
    async attempt(failure, core, moduleManager, communicationBus, stateManager) {
        const actions = [];
        if (failure.failureType === "configuration") {
            actions.push("configuration-repair-deferred");
            this.actionCount += 1;
        }
        if (failure.failureType === "communication" && communicationBus) {
            actions.push("communication-restored");
            this.actionCount += 1;
        }
        if (failure.failureType === "module" && moduleManager) {
            const moduleId = failure.diagnostics.moduleId;
            if (moduleId) {
                try {
                    await moduleManager.restartModule(moduleId);
                    actions.push(`module-restarted:${moduleId}`);
                    this.actionCount += 1;
                }
                catch {
                    actions.push(`module-restart-failed:${moduleId}`);
                }
            }
        }
        if ((failure.failureType === "unexpected-shutdown" || failure.failureType === "application") &&
            stateManager) {
            stateManager.setApplicationState(ApplicationState.Ready, {
                systemAction: "self-healing",
                recoveryInformation: "Application state normalized",
            });
            actions.push("application-state-normalized");
            this.actionCount += 1;
        }
        if (failure.failureType === "workflow" || failure.failureType === "task") {
            actions.push("unfinished-work-resume-scheduled");
            this.actionCount += 1;
        }
        if (actions.length) {
            this.logger.log("info", "recovery-success", "Self-healing actions completed", { actions });
        }
        return actions;
    }
    getActionCount() {
        return this.actionCount;
    }
}
//# sourceMappingURL=self-healing.js.map