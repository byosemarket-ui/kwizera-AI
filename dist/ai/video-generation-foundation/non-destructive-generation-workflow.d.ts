import { GenerationWorkflowActionType, GenerationWorkflowEditEntry, GenerationWorkflowState } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
export declare class NonDestructiveGenerationWorkflow {
    private readonly logger;
    private states;
    private workflowPath;
    private catalogPath;
    constructor(logger: VideoGenerationFoundationLogger);
    initialize(storage: VideoGenerationStorageManager): void;
    initializeProject(projectId: string, videoId?: string): GenerationWorkflowState;
    recordEdit(projectId: string, actionType: GenerationWorkflowActionType, summary: string, beforeStateRef: string, afterStateRef: string, videoId?: string): GenerationWorkflowEditEntry;
    undo(projectId: string, videoId?: string): GenerationWorkflowEditEntry | null;
    redo(projectId: string, videoId?: string): GenerationWorkflowEditEntry | null;
    rollback(projectId: string, videoId?: string): boolean;
    verifyIntegrity(): {
        valid: boolean;
        issues: string[];
    };
    repairSafeIssues(): void;
    private stateKey;
    private persistOriginalMarker;
    private loadFromDisk;
    private persist;
}
//# sourceMappingURL=non-destructive-generation-workflow.d.ts.map