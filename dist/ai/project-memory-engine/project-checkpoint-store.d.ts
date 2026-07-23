import { ProjectCheckpoint } from "./types.js";
export declare class ProjectCheckpointStore {
    private checkpointsDir;
    private readonly checkpoints;
    initialize(projectDir: string): void;
    create(projectId: string, data: Omit<ProjectCheckpoint, "checkpointId" | "projectId" | "timestamp">): ProjectCheckpoint;
    getLatest(projectId: string): ProjectCheckpoint | undefined;
    getById(checkpointId: string): ProjectCheckpoint | undefined;
    getCount(): number;
}
//# sourceMappingURL=project-checkpoint-store.d.ts.map