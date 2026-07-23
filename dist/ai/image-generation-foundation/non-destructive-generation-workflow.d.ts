import { ImageGenerationWorkflowActionType, ImageGenerationWorkflowEditEntry, ImageGenerationWorkflowState } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
export declare class NonDestructiveGenerationWorkflow {
    private readonly logger;
    private states;
    private workflowPath;
    private catalogPath;
    constructor(logger: ImageGenerationFoundationLogger);
    initialize(storage: ImageGenerationStorageManager): void;
    initializeProject(projectId: string, imageId?: string): ImageGenerationWorkflowState;
    recordEdit(projectId: string, actionType: ImageGenerationWorkflowActionType, summary: string, beforeStateRef: string, afterStateRef: string, imageId?: string): ImageGenerationWorkflowEditEntry;
    undo(projectId: string, imageId?: string): ImageGenerationWorkflowEditEntry | null;
    redo(projectId: string, imageId?: string): ImageGenerationWorkflowEditEntry | null;
    rollback(projectId: string, imageId?: string): boolean;
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