import { ProjectState } from "../state-manager/types.js";
export class ProjectRecoveryHandler {
    logger;
    assets = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    registerProjectAssets(projectId, assets) {
        this.assets.set(projectId, {
            projectId,
            ...assets,
            restoredAt: new Date().toISOString(),
        });
    }
    restoreProject(projectId) {
        const saved = this.assets.get(projectId);
        if (saved) {
            this.logger.log("info", "recovery-success", `Project assets restored: ${projectId}`, {
                images: saved.images.length,
                videos: saved.videos.length,
            });
        }
        return saved;
    }
    getRestoredProjectState() {
        return ProjectState.Open;
    }
}
//# sourceMappingURL=project-recovery-handler.js.map