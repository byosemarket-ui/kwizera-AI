import { ProjectState } from "../state-manager/types.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";

export interface ProjectRecoveryAssets {
  projectId: string;
  images: string[];
  videos: string[];
  productInformation: Record<string, unknown>;
  brandAssets: string[];
  generatedContent: string[];
  workflowProgress: Record<string, unknown>;
  drafts: string[];
  userSettings: Record<string, unknown>;
  restoredAt: string;
}

export class ProjectRecoveryHandler {
  private readonly assets = new Map<string, ProjectRecoveryAssets>();

  constructor(private readonly logger: RecoveryEngineLogger) {}

  registerProjectAssets(projectId: string, assets: Omit<ProjectRecoveryAssets, "projectId" | "restoredAt">): void {
    this.assets.set(projectId, {
      projectId,
      ...assets,
      restoredAt: new Date().toISOString(),
    });
  }

  restoreProject(projectId: string): ProjectRecoveryAssets | undefined {
    const saved = this.assets.get(projectId);
    if (saved) {
      this.logger.log("info", "recovery-success", `Project assets restored: ${projectId}`, {
        images: saved.images.length,
        videos: saved.videos.length,
      });
    }
    return saved;
  }

  getRestoredProjectState(): ProjectState {
    return ProjectState.Open;
  }
}
