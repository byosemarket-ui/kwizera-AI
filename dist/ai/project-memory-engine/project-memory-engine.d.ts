import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProjectCheckpointStore } from "./project-checkpoint-store.js";
import { ProjectHistoryStore } from "./project-history-store.js";
import { ProjectMemoryLogger } from "./project-logger.js";
import { ProjectCreateInput, ProjectMemoryStatusReport, ProjectProcessResult, ProjectRecord, ProjectRestoreResult, ProjectUpdateInput, ProjectVersionComparison, ProjectVersionInfo } from "./types.js";
/**
 * Project Memory Engine — permanent project storage, versioning, and recovery.
 */
export declare class AiProjectMemoryEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: ProjectMemoryLogger;
    readonly history: ProjectHistoryStore;
    readonly checkpoints: ProjectCheckpointStore;
    private readonly projects;
    private readonly scorer;
    private linker;
    private processor;
    private restorer;
    private saveTimes;
    private loadTimes;
    private restoreTimes;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createProject(input: ProjectCreateInput): Promise<ProjectProcessResult>;
    updateProject(projectId: string, input: ProjectUpdateInput): Promise<ProjectProcessResult>;
    getProject(projectId: string): Promise<ProjectRecord | null>;
    listProjects(): Promise<ProjectRecord[]>;
    restoreProject(projectId: string, checkpointId?: string): Promise<ProjectRestoreResult>;
    archiveProject(projectId: string): Promise<ProjectProcessResult>;
    getProjectHistory(projectId: string): import("./project-history-store.js").ProjectHistoryEvent[];
    getProjectVersions(projectId: string): ProjectVersionInfo[];
    compareVersions(projectId: string, versionA: number, versionB: number): Promise<ProjectVersionComparison>;
    searchProjects(query: {
        name?: string;
        projectType?: string;
        brand?: string;
        language?: string;
        tags?: string[];
    }): ProjectRecord[];
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): ProjectMemoryStatusReport;
    private ensureReady;
}
//# sourceMappingURL=project-memory-engine.d.ts.map