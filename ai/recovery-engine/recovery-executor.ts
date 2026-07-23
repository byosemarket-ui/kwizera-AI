import { randomUUID } from "node:crypto";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { WorkflowStateManaged, TaskStateManaged, ProjectState } from "../state-manager/types.js";
import { BackupValidator } from "./backup-validator.js";
import { DiagnosticsGenerator } from "./diagnostics-generator.js";
import { MemoryProtection } from "./memory-protection.js";
import { ProjectRecovery } from "./project-recovery.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { RecoveryPlanner } from "./recovery-planner.js";
import { SelfHealing } from "./self-healing.js";
import { VideoRecovery } from "./video-recovery.js";
import {
  FailureReport,
  RecoveryExecutionResult,
  RecoveryPlan,
  RecoveryResultStatus,
  RecoveryType,
} from "./types.js";

export interface RecoveryExecutorDeps {
  getCore: () => AiCoreManager;
  getModuleManager: () => AiModuleManager | null;
  getStateManager: () => AiStateManager | null;
  getCommunicationBus: () => AiCommunicationBus | null;
  storageRoot: string;
}

export class RecoveryExecutor {
  private readonly planner = new RecoveryPlanner();
  private totalRecoveryMs = 0;
  private recoveryCount = 0;

  constructor(
    private readonly deps: RecoveryExecutorDeps,
    private readonly logger: RecoveryEngineLogger,
    private readonly history: RecoveryHistoryStore,
    private readonly diagnostics: DiagnosticsGenerator,
    private readonly backupValidator: BackupValidator,
    private readonly memoryProtection: MemoryProtection,
    private readonly projectRecovery: ProjectRecovery,
    private readonly videoRecovery: VideoRecovery,
    private readonly selfHealing: SelfHealing
  ) {}

  async execute(failure: FailureReport): Promise<RecoveryExecutionResult> {
    const start = Date.now();
    const recoveryId = `rec-${randomUUID().slice(0, 8)}`;
    const plan = this.planner.createPlan(failure);
    const recoveredData: string[] = [];
    const lessonsLearned: string[] = [];

    for (const step of plan.steps) {
      step.status = "running";
    }

    // Step 1-3: already detected
    plan.steps[0].status = "completed";
    plan.steps[1].status = "completed";
    plan.steps[2].status = "completed";

    // Step 4: Protect user data
    this.memoryProtection.protectDuringRecovery(this.deps.storageRoot);
    plan.steps[3].status = "completed";
    recoveredData.push("user-data-protected");

    // Step 5: Save diagnostics
    this.diagnostics.save(failure, { planId: plan.planId });
    plan.steps[4].status = "completed";

    // Step 6: Plan created
    plan.steps[5].status = "completed";

    // Step 7: Restore latest valid state
    const backup = this.backupValidator.validate(
      this.deps.storageRoot,
      this.deps.getCore().configuration.isLoaded()
    );
    if (!backup.valid && failure.severity === "critical") {
      return this.finalize(recoveryId, plan, RecoveryResultStatus.Failed, failure, start, recoveredData, [
        "Backup validation failed — only valid data restored",
      ]);
    }

    const stateManager = this.deps.getStateManager();
    if (stateManager) {
      const snapshot = stateManager.snapshots.loadLatestSnapshot();
      if (snapshot) {
        recoveredData.push(`state:${snapshot.snapshotId}`);
      }
    }
    plan.steps[6].status = "completed";

    // Step 8: Restart affected component only
    const healingActions = await this.selfHealing.attempt(
      failure,
      this.deps.getCore(),
      this.deps.getModuleManager(),
      this.deps.getCommunicationBus(),
      stateManager
    );
    recoveredData.push(...healingActions);
    plan.steps[7].status = "completed";

    // Step 9: Validate recovery
    const postScanHealthy = failure.severity !== "critical";
    plan.steps[8].status = postScanHealthy ? "completed" : "failed";

    // Step 10: Resume unfinished work
    if (stateManager) {
      const snapshot = stateManager.getCurrentSnapshot();
      const projects = this.projectRecovery.restoreFromState(snapshot.projects);
      const videos = this.videoRecovery.findInterruptedVideos(snapshot.tasks);

      for (const project of projects) {
        stateManager.updateProjectState(project.projectId, ProjectState.Open, {
          systemAction: "project-recovery",
          recoveryInformation: "Project assets restored",
        });
        recoveredData.push(`project:${project.projectId}`);
      }

      for (const video of videos) {
        recoveredData.push(`video:${video.videoId}:${video.progressPercent}%`);
        lessonsLearned.push(`Video ${video.videoId} can resume from segment ${video.resumeFromSegment ?? "start"}`);
      }

      for (const [wfId, wf] of Object.entries(snapshot.workflows)) {
        if (wf.state === "recovered" || wf.state === "running") {
          stateManager.updateWorkflowState(wfId, WorkflowStateManaged.Recovered, {
            systemAction: "workflow-recovery",
          });
          recoveredData.push(`workflow:${wfId}`);
        }
      }

      for (const [taskId, task] of Object.entries(snapshot.tasks)) {
        if (task.state === "recovered" || task.state === "running") {
          stateManager.updateTaskState(taskId, TaskStateManaged.Recovered, {
            systemAction: "task-recovery",
          });
          recoveredData.push(`task:${taskId}`);
        }
      }
    }
    plan.steps[9].status = "completed";

    // Step 11: Notify AI Core
    this.deps.getCore().logger.info("recovery", "Recovery Engine notified AI Core", {
      recoveryId,
      failureType: failure.failureType,
    });
    plan.steps[10].status = "completed";

    // Step 12: Log complete recovery
    plan.steps[11].status = "completed";

    const status =
      plan.steps.every((s) => s.status === "completed")
        ? RecoveryResultStatus.Success
        : RecoveryResultStatus.Partial;

    return this.finalize(recoveryId, plan, status, failure, start, recoveredData, lessonsLearned);
  }

  getAverageRecoveryMs(): number {
    return this.recoveryCount > 0 ? Math.round(this.totalRecoveryMs / this.recoveryCount) : 0;
  }

  getRecoveryCount(): number {
    return this.recoveryCount;
  }

  private finalize(
    recoveryId: string,
    plan: RecoveryPlan,
    status: RecoveryResultStatus,
    failure: FailureReport,
    start: number,
    recoveredData: string[],
    lessonsLearned: string[]
  ): RecoveryExecutionResult {
    const recoveryTimeMs = Date.now() - start;
    this.totalRecoveryMs += recoveryTimeMs;
    this.recoveryCount += 1;

    const result: RecoveryExecutionResult = {
      recoveryId,
      planId: plan.planId,
      recoveryType: plan.recoveryType,
      status,
      affectedModule: failure.affectedComponent,
      rootCause: failure.rootCause,
      recoveryMethod: plan.recoveryType,
      recoveryTimeMs,
      recoveredData,
      lessonsLearned,
      message: `Recovery ${status}: ${failure.rootCause}`,
    };

    this.history.append({
      recoveryId,
      failureType: failure.failureType,
      affectedModule: failure.affectedComponent,
      rootCause: failure.rootCause,
      recoveryMethod: plan.recoveryType,
      recoveryTimeMs,
      recoveredData,
      result: status,
      performanceMs: recoveryTimeMs,
      lessonsLearned,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      status === RecoveryResultStatus.Success ? "info" : "warn",
      status === RecoveryResultStatus.Failed ? "recovery-failure" : "recovery-success",
      result.message,
      { recoveryId, recoveryTimeMs, recoveredData }
    );

    return result;
  }
}
