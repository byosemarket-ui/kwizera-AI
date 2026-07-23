import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProjectCheckpointStore } from "./project-checkpoint-store.js";
import { ProjectHistoryStore } from "./project-history-store.js";
import { ProjectMemoryLogger } from "./project-logger.js";
import { ProjectRelationshipLinker } from "./project-relationship-linker.js";
import { ProjectScorer } from "./project-scorer.js";
import { ProjectCreateInput, ProjectProcessResult, ProjectRecord, ProjectUpdateInput } from "./types.js";
export declare function recordFromMemory(record: MemoryRecord): ProjectRecord;
export declare class ProjectProcessor {
    private readonly foundation;
    private readonly history;
    private readonly checkpoints;
    private readonly scorer;
    private readonly linker;
    private readonly logger;
    private readonly projects;
    constructor(foundation: AiMemoryFoundation, history: ProjectHistoryStore, checkpoints: ProjectCheckpointStore, scorer: ProjectScorer, linker: ProjectRelationshipLinker, logger: ProjectMemoryLogger, projects: Map<string, ProjectRecord>);
    create(input: ProjectCreateInput): Promise<ProjectProcessResult>;
    update(projectId: string, input: ProjectUpdateInput): Promise<ProjectProcessResult>;
    loadProject(projectId: string): Promise<ProjectRecord | null>;
    private toMemoryInput;
    private toPayload;
    private mergeAssets;
    private mergeWorkflow;
    private summarizeChanges;
    private fail;
}
//# sourceMappingURL=project-processor.d.ts.map