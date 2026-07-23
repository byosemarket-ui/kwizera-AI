import { VideoWorkflowActionType, VideoWorkflowEditEntry, VideoWorkflowState } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
export declare class NonDestructiveWorkflow {
    private readonly logger;
    private states;
    private workflowPath;
    private catalogPath;
    constructor(logger: VideoIntelligenceFoundationLogger);
    initialize(storage: VideoIntelligenceStorageManager): void;
    initializeVideo(projectId: string, videoId: string): VideoWorkflowState;
    recordEdit(projectId: string, videoId: string, actionType: VideoWorkflowActionType, summary: string, beforeStateRef: string, afterStateRef: string, timelineId?: string): VideoWorkflowEditEntry;
    undo(projectId: string, videoId: string): VideoWorkflowEditEntry | null;
    redo(projectId: string, videoId: string): VideoWorkflowEditEntry | null;
    restoreOriginal(projectId: string, videoId: string): VideoWorkflowState;
    getState(projectId: string, videoId: string): VideoWorkflowState | undefined;
    getEditHistory(projectId: string, videoId: string): VideoWorkflowEditEntry[];
    verifyIntegrity(): {
        valid: boolean;
        issues: string[];
    };
    repairSafeIssues(): string[];
    private stateKey;
    private persistOriginalMarker;
    private loadFromDisk;
    private persist;
}
//# sourceMappingURL=non-destructive-workflow.d.ts.map