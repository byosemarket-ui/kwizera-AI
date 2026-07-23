/**
 * KWIZERA AI STUDIO — AI State Manager types (Step 2I)
 */
import type { AiLifecycleState } from "../core/types.js";
export declare enum ApplicationState {
    Starting = "starting",
    Loading = "loading",
    Ready = "ready",
    Running = "running",
    Paused = "paused",
    Updating = "updating",
    Recovering = "recovering",
    Stopping = "stopping",
    Stopped = "stopped"
}
export declare enum WorkflowStateManaged {
    Created = "created",
    Running = "running",
    Waiting = "waiting",
    Paused = "paused",
    Completed = "completed",
    Failed = "failed",
    Recovered = "recovered"
}
export declare enum TaskStateManaged {
    Queued = "queued",
    Running = "running",
    Retrying = "retrying",
    Completed = "completed",
    Cancelled = "cancelled",
    Failed = "failed",
    Recovered = "recovered"
}
export declare enum ProjectState {
    New = "new",
    Open = "open",
    Modified = "modified",
    Saving = "saving",
    Saved = "saved",
    Exporting = "exporting",
    Completed = "completed",
    Archived = "archived"
}
export declare enum SessionStateManaged {
    Created = "created",
    Active = "active",
    Idle = "idle",
    Paused = "paused",
    Expired = "expired",
    Closed = "closed"
}
export declare enum SystemState {
    Operational = "operational",
    Degraded = "degraded",
    Maintenance = "maintenance",
    Recovery = "recovery",
    Offline = "offline"
}
export type AutoSaveTrigger = "workflow-execution" | "video-generation" | "project-editing" | "learning" | "memory-update" | "knowledge-update" | "recovery";
export interface EntityStateRecord {
    id: string;
    state: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
}
export interface ApplicationStateSnapshot {
    application: ApplicationState;
    aiCore: AiLifecycleState;
    system: SystemState;
    modules: Record<string, EntityStateRecord>;
    workflows: Record<string, EntityStateRecord>;
    tasks: Record<string, EntityStateRecord>;
    projects: Record<string, EntityStateRecord>;
    sessions: Record<string, EntityStateRecord>;
}
export interface StateSnapshot {
    snapshotId: string;
    timestamp: string;
    reason: string;
    cleanShutdown: boolean;
    state: ApplicationStateSnapshot;
}
export interface StateHistoryRecord {
    stateId: string;
    time: string;
    module: string;
    previousState: string;
    currentState: string;
    reason: string;
    userAction?: string;
    systemAction?: string;
    recoveryInformation?: string;
}
export interface StateTransitionContext {
    reason?: string;
    userAction?: string;
    systemAction?: string;
    recoveryInformation?: string;
    metadata?: Record<string, unknown>;
}
export interface StateTransitionResult {
    accepted: boolean;
    previousState: string;
    currentState: string;
    message: string;
}
export interface RestorationResult {
    restored: boolean;
    snapshotId?: string;
    restoredWorkflows: number;
    restoredTasks: number;
    restoredProjects: number;
    restoredSessions: number;
    message: string;
}
export interface StateManagerStatusReport {
    stateManagerStatus: string;
    snapshotStatus: string;
    recoveryStatus: string;
    autoSaveStatus: string;
    performance: {
        stateUpdates: number;
        snapshotsCreated: number;
        averageUpdateMs: number;
        diskWrites: number;
        memoryUsageMb: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class StateManagerError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export type StateDomain = "application" | "ai-core" | "workflow" | "task" | "project" | "session" | "module" | "system";
//# sourceMappingURL=types.d.ts.map