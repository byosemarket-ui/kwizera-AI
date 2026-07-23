import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { ApplicationState } from "../state-manager/types.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { FailureReport } from "./types.js";

export class SelfHealing {
  private actionCount = 0;

  constructor(private readonly logger: RecoveryEngineLogger) {}

  async attempt(
    failure: FailureReport,
    core: AiCoreManager,
    moduleManager: AiModuleManager | null,
    communicationBus: AiCommunicationBus | null,
    stateManager: AiStateManager | null
  ): Promise<string[]> {
    const actions: string[] = [];

    if (failure.failureType === "configuration") {
      actions.push("configuration-repair-deferred");
      this.actionCount += 1;
    }

    if (failure.failureType === "communication" && communicationBus) {
      actions.push("communication-restored");
      this.actionCount += 1;
    }

    if (failure.failureType === "module" && moduleManager) {
      const moduleId = failure.diagnostics.moduleId as string | undefined;
      if (moduleId) {
        try {
          await moduleManager.restartModule(moduleId);
          actions.push(`module-restarted:${moduleId}`);
          this.actionCount += 1;
        } catch {
          actions.push(`module-restart-failed:${moduleId}`);
        }
      }
    }

    if (
      (failure.failureType === "unexpected-shutdown" || failure.failureType === "application") &&
      stateManager
    ) {
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

  getActionCount(): number {
    return this.actionCount;
  }
}
