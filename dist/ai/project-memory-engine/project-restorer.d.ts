import { ProjectCheckpointStore } from "./project-checkpoint-store.js";
import { ProjectHistoryStore } from "./project-history-store.js";
import { ProjectMemoryLogger } from "./project-logger.js";
import { ProjectProcessor } from "./project-processor.js";
import { ProjectRestoreResult } from "./types.js";
export declare class ProjectRestorer {
    private readonly processor;
    private readonly checkpoints;
    private readonly history;
    private readonly logger;
    constructor(processor: ProjectProcessor, checkpoints: ProjectCheckpointStore, history: ProjectHistoryStore, logger: ProjectMemoryLogger);
    restore(projectId: string, checkpointId?: string): Promise<ProjectRestoreResult>;
}
//# sourceMappingURL=project-restorer.d.ts.map