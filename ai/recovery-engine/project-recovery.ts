import { RecoveryEngineLogger } from "./recovery-logger.js";
import { ProjectRecoveryContext } from "./types.js";

export class ProjectRecovery {
  constructor(private readonly logger: RecoveryEngineLogger) {}

  buildRecoveryContext(
    projectId: string,
    metadata?: Record<string, unknown>
  ): ProjectRecoveryContext {
    const context: ProjectRecoveryContext = {
      projectId,
      assets: {
        images: (metadata?.images as string[]) ?? [],
        videos: (metadata?.videos as string[]) ?? [],
        productInfo: Boolean(metadata?.productInfo),
        brandAssets: Boolean(metadata?.brandAssets),
        generatedContent: Boolean(metadata?.generatedContent),
        workflowProgress: Boolean(metadata?.workflowProgress),
        drafts: Boolean(metadata?.drafts),
        userSettings: Boolean(metadata?.userSettings),
      },
    };

    this.logger.log("info", "recovery-attempt", `Project recovery context built: ${projectId}`, {
      assets: context.assets,
    });

    return context;
  }

  restoreFromState(
    projects: Record<string, { id: string; state: string; metadata?: Record<string, unknown> }>
  ): ProjectRecoveryContext[] {
    const contexts: ProjectRecoveryContext[] = [];

    for (const [id, project] of Object.entries(projects)) {
      if (
        project.state === "modified" ||
        project.state === "open" ||
        project.state === "saving" ||
        project.state === "exporting"
      ) {
        contexts.push(this.buildRecoveryContext(id, project.metadata));
      }
    }

    return contexts;
  }
}
