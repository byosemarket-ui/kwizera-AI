import { AudioGenerationWorkflowActionType, AudioGenerationWorkflowEditEntry, AudioGenerationWorkflowState } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
export declare class NonDestructiveGenerationWorkflow {
    private readonly logger;
    private states;
    private workflowPath;
    private catalogPath;
    constructor(logger: AudioGenerationFoundationLogger);
    initialize(storage: AudioGenerationStorageManager): void;
    initializeProject(projectId: string, trackId?: string): AudioGenerationWorkflowState;
    recordEdit(projectId: string, actionType: AudioGenerationWorkflowActionType, summary: string, beforeStateRef: string, afterStateRef: string, trackId?: string): AudioGenerationWorkflowEditEntry;
    undo(projectId: string, trackId?: string): AudioGenerationWorkflowEditEntry | null;
    redo(projectId: string, trackId?: string): AudioGenerationWorkflowEditEntry | null;
    rollback(projectId: string, trackId?: string): boolean;
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