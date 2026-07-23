import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiLifecycleState } from "../core/types.js";
import { StateHistoryStore } from "./state-history-store.js";
import { StateManagerLogger } from "./state-logger.js";
import { StateSnapshotStore } from "./state-snapshot-store.js";
import { ApplicationState, ApplicationStateSnapshot, AutoSaveTrigger, EntityStateRecord, ProjectState, RestorationResult, SessionStateManaged, StateManagerStatusReport, StateSnapshot, StateTransitionContext, StateTransitionResult, SystemState, TaskStateManaged, WorkflowStateManaged } from "./types.js";
/**
 * AI State Manager — single source of truth for KWIZERA AI STUDIO application state.
 */
export declare class AiStateManager {
    private core;
    private storageRoot;
    private initialized;
    private readonly current;
    readonly logger: StateManagerLogger;
    readonly history: StateHistoryStore;
    readonly snapshots: StateSnapshotStore;
    private readonly validator;
    private autoSave;
    private restoration;
    private recovery;
    private stateUpdateCount;
    private totalUpdateMs;
    private lastRestoration;
    private lastRecoveryMessage;
    initialize(core: AiCoreManager, storageRoot: string): void;
    isInitialized(): boolean;
    restoreOnStartup(): Promise<RestorationResult | null>;
    getCurrentSnapshot(): ApplicationStateSnapshot;
    setApplicationState(state: ApplicationState, context?: StateTransitionContext): StateTransitionResult;
    syncAiCoreState(aiCoreState: AiLifecycleState, context?: StateTransitionContext): StateTransitionResult;
    setSystemState(state: SystemState, context?: StateTransitionContext): StateTransitionResult;
    reportModuleState(moduleId: string, state: string, context?: StateTransitionContext): StateTransitionResult;
    updateWorkflowState(workflowId: string, state: WorkflowStateManaged, context?: StateTransitionContext): StateTransitionResult;
    updateTaskState(taskId: string, state: TaskStateManaged, context?: StateTransitionContext): StateTransitionResult;
    updateProjectState(projectId: string, state: ProjectState, context?: StateTransitionContext): StateTransitionResult;
    updateSessionState(sessionId: string, state: SessionStateManaged, context?: StateTransitionContext): StateTransitionResult;
    triggerAutoSave(trigger: AutoSaveTrigger): void;
    createSnapshot(reason: string, cleanShutdown?: boolean): StateSnapshot;
    saveShutdownSnapshot(reason?: string): StateSnapshot;
    getWorkflowState(workflowId: string): EntityStateRecord | undefined;
    getTaskState(taskId: string): EntityStateRecord | undefined;
    getProjectState(projectId: string): EntityStateRecord | undefined;
    getSessionState(sessionId: string): EntityStateRecord | undefined;
    getApplicationState(): ApplicationState;
    getLastRestoration(): RestorationResult | null;
    getLastRecoveryMessage(): string | null;
    buildStatusReport(): StateManagerStatusReport;
    private transition;
    private recordHistory;
    private ensureReady;
}
//# sourceMappingURL=state-manager.d.ts.map