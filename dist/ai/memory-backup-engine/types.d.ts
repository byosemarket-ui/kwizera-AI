/**
 * KWIZERA AI STUDIO — Memory Backup Engine types (Step 3L)
 */
export declare enum BackupType {
    Automatic = "automatic",
    Manual = "manual",
    Incremental = "incremental",
    Full = "full",
    Recovery = "recovery",
    PreUpdate = "pre-update",
    PreOptimization = "pre-optimization",
    Scheduled = "scheduled"
}
export declare enum BackupSource {
    PersistentMemory = "persistent-memory",
    ProjectMemory = "project-memory",
    ProductMemory = "product-memory",
    VideoMemory = "video-memory",
    MarketingMemory = "marketing-memory",
    LearningMemory = "learning-memory",
    KnowledgeMemory = "knowledge-memory",
    RelationshipMemory = "relationship-memory",
    WorkflowHistory = "workflow-history",
    DecisionHistory = "decision-history",
    ReasoningHistory = "reasoning-history",
    Configuration = "configuration",
    Database = "database",
    AiSettings = "ai-settings",
    UserPreferences = "user-preferences",
    ProjectAssets = "project-assets",
    GeneratedVideos = "generated-videos",
    GeneratedImages = "generated-images",
    GeneratedScripts = "generated-scripts"
}
export declare enum RestoreMode {
    Full = "full",
    Project = "project",
    Memory = "memory",
    Configuration = "configuration",
    Database = "database",
    Selective = "selective",
    AiRecovery = "ai-recovery"
}
export declare enum RestorePointTrigger {
    BeforeUpdate = "before-update",
    BeforeOptimization = "before-optimization",
    BeforeMigration = "before-database-migration",
    BeforeConfigurationChange = "before-configuration-change",
    BeforeAiEngineChange = "before-ai-engine-change",
    BeforeMajorProjectChange = "before-major-project-change"
}
export declare enum RetentionTier {
    Latest = "latest",
    Daily = "daily",
    Weekly = "weekly",
    Monthly = "monthly",
    Milestone = "milestone"
}
export interface BackupFileEntry {
    relativePath: string;
    source: BackupSource;
    sizeBytes: number;
    checksum: string;
    compressed: boolean;
}
export interface BackupManifest {
    backupId: string;
    version: number;
    backupType: BackupType;
    projectId?: string;
    createdAt: string;
    storageRoot: string;
    files: BackupFileEntry[];
    totalSizeBytes: number;
    compressedSizeBytes: number;
    recordCount: number;
    edgeCount: number;
    validated: boolean;
    retentionTier: RetentionTier;
    checksum: string;
}
export interface MemoryBackupValidationResult {
    valid: boolean;
    fileIntegrity: boolean;
    databaseIntegrity: boolean;
    memoryIntegrity: boolean;
    relationshipIntegrity: boolean;
    configurationIntegrity: boolean;
    completeness: boolean;
    diagnostics: string[];
}
export interface BackupCreateResult {
    success: boolean;
    backupId: string;
    backupPath: string;
    manifest: BackupManifest;
    validation: MemoryBackupValidationResult;
    durationMs: number;
}
export interface RestorePoint {
    restorePointId: string;
    trigger: RestorePointTrigger;
    backupId: string;
    projectId?: string;
    createdAt: string;
}
export interface RestoreResult {
    success: boolean;
    mode: RestoreMode;
    backupId: string;
    filesRestored: number;
    durationMs: number;
    diagnostics: string[];
}
export interface BackupSchedule {
    enabled: boolean;
    intervalHours: number;
    backupType: BackupType;
    lastRun?: string;
    nextRun?: string;
}
export interface MemoryBackupStatusReport {
    engineStatus: string;
    backupIntegrity: string;
    restoreReadiness: string;
    versionHistoryStatus: string;
    totalBackups: number;
    latestBackupId?: string;
    performance: {
        averageBackupMs: number;
        averageValidationMs: number;
        averageCompressionRatio: number;
        lastBackupMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MemoryBackupEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map