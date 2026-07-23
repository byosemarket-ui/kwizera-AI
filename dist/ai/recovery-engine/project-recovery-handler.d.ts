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
export declare class ProjectRecoveryHandler {
    private readonly logger;
    private readonly assets;
    constructor(logger: RecoveryEngineLogger);
    registerProjectAssets(projectId: string, assets: Omit<ProjectRecoveryAssets, "projectId" | "restoredAt">): void;
    restoreProject(projectId: string): ProjectRecoveryAssets | undefined;
    getRestoredProjectState(): ProjectState;
}
//# sourceMappingURL=project-recovery-handler.d.ts.map