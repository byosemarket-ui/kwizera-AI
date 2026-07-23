/**
 * KWIZERA AI STUDIO — Memory Recovery Engine types (Step 3M)
 */
export declare enum MemoryRecoveryType {
    Full = "full",
    Selective = "selective",
    Project = "project",
    Memory = "memory",
    Database = "database",
    Configuration = "configuration",
    Learning = "learning",
    Relationship = "relationship",
    Emergency = "emergency"
}
export declare enum MemoryRecoverySource {
    AutomaticBackup = "automatic-backup",
    ManualBackup = "manual-backup",
    IncrementalBackup = "incremental-backup",
    FullBackup = "full-backup",
    RestorePoint = "restore-point",
    ProjectSnapshot = "project-snapshot",
    RecoverySnapshot = "recovery-snapshot"
}
export interface MemoryRecoveryRequest {
    recoveryType: MemoryRecoveryType;
    source: MemoryRecoverySource;
    backupId?: string;
    restorePointId?: string;
    projectId?: string;
    pathPrefixes?: string[];
    reason: string;
}
export interface PreRecoveryValidation {
    valid: boolean;
    backupIntegrity: boolean;
    databaseIntegrity: boolean;
    memoryIntegrity: boolean;
    relationshipIntegrity: boolean;
    configurationIntegrity: boolean;
    storageAvailable: boolean;
    diagnostics: string[];
}
export interface StateComparison {
    backupRecordCount: number;
    currentRecordCount: number;
    backupEdgeCount: number;
    currentEdgeCount: number;
    filesToRestore: number;
    differences: string[];
}
export interface PostRecoveryIntegrity {
    valid: boolean;
    memoryConsistency: boolean;
    relationshipConsistency: boolean;
    indexIntegrity: boolean;
    projectIntegrity: boolean;
    learningIntegrity: boolean;
    databaseIntegrity: boolean;
    configurationIntegrity: boolean;
    diagnostics: string[];
}
export interface RecoveryHistoryEntry {
    recoveryId: string;
    recoveryDate: string;
    recoveryType: MemoryRecoveryType;
    source: MemoryRecoverySource;
    recoveredComponents: string[];
    backupVersion: number;
    backupId: string;
    durationMs: number;
    integrityResult: boolean;
    success: boolean;
    performanceMs: number;
    lessonsLearned: string[];
}
export interface MemoryRecoveryResult {
    success: boolean;
    recoveryId: string;
    request: MemoryRecoveryRequest;
    safetySnapshotId?: string;
    filesRestored: number;
    stepsCompleted: number;
    preValidation: PreRecoveryValidation;
    postIntegrity: PostRecoveryIntegrity;
    durationMs: number;
    diagnostics: string[];
}
export interface MemoryRecoveryStatusReport {
    engineStatus: string;
    recoverySuccessRate: string;
    integrityStatus: string;
    projectRecoveryStatus: string;
    learningRecoveryStatus: string;
    totalRecoveries: number;
    successfulRecoveries: number;
    performance: {
        averageRecoveryMs: number;
        averageValidationMs: number;
        lastRecoveryMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MemoryRecoveryEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map