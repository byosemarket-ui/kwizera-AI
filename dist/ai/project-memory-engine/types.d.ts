/**
 * KWIZERA AI STUDIO — Project Memory Engine types (Step 3F)
 */
export declare enum ProjectStatus {
    Created = "created",
    Editing = "editing",
    Processing = "processing",
    Paused = "paused",
    Waiting = "waiting",
    Completed = "completed",
    Exported = "exported",
    Archived = "archived",
    Recovered = "recovered"
}
export declare enum ProjectType {
    Promotional = "promotional",
    Brand = "brand",
    Marketing = "marketing",
    Product = "product",
    Social = "social",
    Campaign = "campaign",
    General = "general"
}
export interface ProjectAssetRefs {
    images: string[];
    videos: string[];
    audio: string[];
    logos: string[];
    brandAssets: string[];
    scripts: string[];
    captions: string[];
    posters: string[];
    marketingContent: string[];
    generatedVideos: string[];
}
export interface ProjectWorkflowHistory {
    workflowHistory: string[];
    aiDecisions: string[];
    reasoningHistory: string[];
    planningHistory: string[];
    taskHistory: string[];
    recoveryHistory: string[];
    validationHistory: string[];
}
export interface ProjectScores {
    qualityScore: number;
    learningScore: number;
    completionScore: number;
    recoveryScore: number;
    aiConfidenceScore: number;
}
export interface ProjectExportRecord {
    exportId: string;
    format: string;
    timestamp: string;
    path?: string;
}
export interface ProjectCheckpoint {
    checkpointId: string;
    projectId: string;
    timestamp: string;
    status: ProjectStatus;
    completionPercentage: number;
    workflowState?: Record<string, unknown>;
    draftState?: Record<string, unknown>;
    aiContext?: Record<string, unknown>;
    assetRefs: ProjectAssetRefs;
    scores: ProjectScores;
}
export interface ProjectVersionInfo {
    version: number;
    timestamp: string;
    changeSummary: string;
    memoryVersion: number;
}
export interface ProjectCreateInput {
    projectId?: string;
    projectName: string;
    projectType: ProjectType;
    description: string;
    targetAudience?: string;
    marketingGoal?: string;
    brandInformation?: Record<string, unknown>;
    language?: string;
    tags?: string[];
    keywords?: string[];
}
export interface ProjectUpdateInput {
    projectName?: string;
    projectType?: ProjectType;
    status?: ProjectStatus;
    completionPercentage?: number;
    description?: string;
    targetAudience?: string;
    marketingGoal?: string;
    brandInformation?: Record<string, unknown>;
    language?: string;
    tags?: string[];
    keywords?: string[];
    assets?: Partial<ProjectAssetRefs>;
    assetsReplace?: ProjectAssetRefs;
    workflowHistory?: Partial<ProjectWorkflowHistory>;
    exportRecord?: ProjectExportRecord;
    draftState?: Record<string, unknown>;
    aiContext?: Record<string, unknown>;
    workflowState?: Record<string, unknown>;
}
export interface ProjectRecord {
    projectId: string;
    memoryId: string;
    projectName: string;
    projectType: ProjectType;
    creationDate: string;
    lastModified: string;
    status: ProjectStatus;
    completionPercentage: number;
    description: string;
    targetAudience: string;
    marketingGoal: string;
    brandInformation: Record<string, unknown>;
    language: string;
    exportHistory: ProjectExportRecord[];
    assets: ProjectAssetRefs;
    workflowHistory: ProjectWorkflowHistory;
    scores: ProjectScores;
    relatedMemories: string[];
    versions: ProjectVersionInfo[];
    latestCheckpointId?: string;
    tags: string[];
    keywords: string[];
}
export interface ProjectProcessResult {
    success: boolean;
    projectId: string;
    memoryId: string;
    version: number;
    durationMs: number;
    checkpointCreated: boolean;
    reason?: string;
}
export interface ProjectRestoreResult {
    success: boolean;
    projectId: string;
    restoredFrom: string;
    status: ProjectStatus;
    completionPercentage: number;
    durationMs: number;
    reason?: string;
}
export interface ProjectVersionComparison {
    projectId: string;
    versionA: number;
    versionB: number;
    differences: string[];
}
export interface ProjectMemoryStatusReport {
    engineStatus: string;
    projectStorageStatus: string;
    versionManagementStatus: string;
    recoveryStatus: string;
    totalProjects: number;
    activeProjects: number;
    archivedProjects: number;
    performance: {
        averageSaveMs: number;
        averageLoadMs: number;
        averageRestoreMs: number;
        totalVersions: number;
        totalCheckpoints: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ProjectMemoryEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map