import { ProjectCheckpointStore } from "./project-checkpoint-store.js";
import { ProjectHistoryStore } from "./project-history-store.js";
import { ProjectMemoryLogger } from "./project-logger.js";
import { ProjectProcessor } from "./project-processor.js";
import { ProjectRestoreResult, ProjectStatus } from "./types.js";

export class ProjectRestorer {
  constructor(
    private readonly processor: ProjectProcessor,
    private readonly checkpoints: ProjectCheckpointStore,
    private readonly history: ProjectHistoryStore,
    private readonly logger: ProjectMemoryLogger
  ) {}

  async restore(projectId: string, checkpointId?: string): Promise<ProjectRestoreResult> {
    const start = Date.now();

    const checkpoint = checkpointId
      ? this.checkpoints.getById(checkpointId)
      : this.checkpoints.getLatest(projectId);

    if (!checkpoint) {
      return {
        success: false,
        projectId,
        restoredFrom: "",
        status: ProjectStatus.Created,
        completionPercentage: 0,
        durationMs: Date.now() - start,
        reason: "No checkpoint available for restoration",
      };
    }

    const result = await this.processor.update(projectId, {
      status: ProjectStatus.Recovered,
      completionPercentage: checkpoint.completionPercentage,
      assetsReplace: checkpoint.assetRefs,
      workflowState: checkpoint.workflowState,
      draftState: checkpoint.draftState,
      aiContext: checkpoint.aiContext,
      workflowHistory: {
        recoveryHistory: [`Restored from checkpoint ${checkpoint.checkpointId}`],
      },
    });

    if (!result.success) {
      return {
        success: false,
        projectId,
        restoredFrom: checkpoint.checkpointId,
        status: checkpoint.status,
        completionPercentage: checkpoint.completionPercentage,
        durationMs: Date.now() - start,
        reason: result.reason,
      };
    }

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "restore",
      projectId,
      detail: `Restored from checkpoint ${checkpoint.checkpointId}`,
      status: ProjectStatus.Recovered,
    });

    this.logger.log("info", "recovery", "Project restored", {
      projectId,
      checkpointId: checkpoint.checkpointId,
    });

    return {
      success: true,
      projectId,
      restoredFrom: checkpoint.checkpointId,
      status: ProjectStatus.Recovered,
      completionPercentage: checkpoint.completionPercentage,
      durationMs: Date.now() - start,
    };
  }
}
