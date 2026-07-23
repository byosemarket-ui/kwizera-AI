/**
 * KWIZERA AI STUDIO — Memory Storage Engine types (Step 3B)
 */
export declare enum MemoryStorageType {
    Project = "project-memory",
    Product = "product-memory",
    Video = "video-memory",
    Marketing = "marketing-memory",
    Knowledge = "knowledge-memory",
    Learning = "learning-memory",
    Language = "language-memory",
    Workflow = "workflow-memory",
    Decision = "decision-memory",
    Reasoning = "reasoning-memory",
    UserPreference = "user-preference-memory",
    System = "system-memory"
}
export declare enum MemoryRecordStatus {
    Active = "active",
    Archived = "archived",
    Pending = "pending",
    Deleted = "deleted"
}
export declare enum MemoryIntegrityStatus {
    Verified = "verified",
    Unverified = "unverified",
    Corrupted = "corrupted",
    PendingVerification = "pending-verification"
}
export declare enum StorageValidationCode {
    MissingRequiredField = "missing-required-field",
    InvalidData = "invalid-data",
    CorruptedRecord = "corrupted-record",
    DuplicateRecord = "duplicate-record",
    StorageUnavailable = "storage-unavailable",
    AccessDenied = "access-denied"
}
export interface MemoryRecord {
    memoryId: string;
    memoryType: MemoryStorageType;
    category: string;
    title: string;
    description: string;
    tags: string[];
    keywords: string[];
    creationTime: string;
    lastUpdate: string;
    source: string;
    relatedProject?: string;
    relatedWorkflow?: string;
    relatedFiles: string[];
    qualityScore: number;
    status: MemoryRecordStatus;
    version: number;
    storageLocation: string;
    integrityStatus: MemoryIntegrityStatus;
    contentHash: string;
    searchableText: string;
    payload?: Record<string, unknown>;
}
export interface MemoryRecordInput {
    memoryId?: string;
    memoryType: MemoryStorageType;
    category: string;
    title: string;
    description: string;
    tags?: string[];
    keywords?: string[];
    source: string;
    relatedProject?: string;
    relatedWorkflow?: string;
    relatedFiles?: string[];
    qualityScore?: number;
    status?: MemoryRecordStatus;
    payload?: Record<string, unknown>;
}
export interface MemoryRecordUpdate {
    category?: string;
    title?: string;
    description?: string;
    tags?: string[];
    keywords?: string[];
    relatedProject?: string;
    relatedWorkflow?: string;
    relatedFiles?: string[];
    qualityScore?: number;
    status?: MemoryRecordStatus;
    payload?: Record<string, unknown>;
}
export interface StorageValidationResult {
    valid: boolean;
    code?: StorageValidationCode;
    message: string;
    diagnostics: string[];
}
export interface StorageWriteResult {
    success: boolean;
    record?: MemoryRecord;
    validation?: StorageValidationResult;
    durationMs: number;
    version?: number;
}
export interface StorageReadResult {
    success: boolean;
    record?: MemoryRecord;
    durationMs: number;
    message?: string;
}
export interface MemoryVersionEntry {
    version: number;
    timestamp: string;
    storagePath: string;
    contentHash: string;
}
export interface MemoryStorageIndexEntry {
    memoryId: string;
    memoryType: MemoryStorageType;
    title: string;
    category: string;
    source: string;
    contentHash: string;
    fingerprint: string;
    version: number;
    storageLocation: string;
    lastUpdate: string;
    searchableText: string;
}
export interface MemoryStorageIndex {
    version: string;
    lastUpdated: string;
    recordCount: number;
    entries: MemoryStorageIndexEntry[];
}
export interface IntegrityCheckResult {
    verified: boolean;
    recordsChecked: number;
    issues: string[];
    relationshipsValid: boolean;
    metadataAccurate: boolean;
    filesAvailable: boolean;
    timestamp: string;
}
export interface MemoryStorageStatusReport {
    engineStatus: string;
    storageStatus: string;
    validationStatus: string;
    integrityStatus: string;
    recordCount: number;
    supportedTypes: number;
    performance: {
        averageWriteMs: number;
        averageReadMs: number;
        lastWriteMs: number;
        lastReadMs: number;
        indexSize: number;
    };
    versionManagement: {
        enabled: boolean;
        totalVersions: number;
    };
    backupReady: boolean;
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MemoryStorageEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map