/**
 * KWIZERA AI STUDIO — Persistent Memory Foundation types (Step 3A)
 */
export declare enum MemoryLifecycleState {
    Initializing = "initializing",
    Loading = "loading",
    Ready = "ready",
    Reading = "reading",
    Writing = "writing",
    Updating = "updating",
    BackingUp = "backing-up",
    Recovering = "recovering",
    Optimizing = "optimizing",
    Closing = "closing",
    Closed = "closed"
}
export declare enum MemoryCategory {
    Persistent = "persistent-memory",
    Project = "project-memory",
    Product = "product-memory",
    Video = "video-memory",
    Marketing = "marketing-memory",
    Knowledge = "knowledge-memory",
    Language = "language-memory",
    Learning = "learning-memory",
    UserPreference = "user-preference-memory",
    Workflow = "workflow-memory",
    Decision = "decision-memory",
    Reasoning = "reasoning-memory"
}
export declare enum MemoryModuleStatus {
    Prepared = "prepared",
    Registered = "registered",
    Active = "active",
    Disabled = "disabled",
    Recovering = "recovering",
    Failed = "failed"
}
export declare enum MemoryHealthLevel {
    Excellent = "excellent",
    Good = "good",
    Warning = "warning",
    Critical = "critical",
    Failed = "failed"
}
export declare enum MemoryAccessPermission {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Admin = "admin"
}
export declare enum MemoryAccessOperation {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Backup = "backup",
    Recover = "recover"
}
export interface MemoryModuleRegistration {
    memoryId: string;
    memoryName: string;
    version: string;
    status: MemoryModuleStatus;
    dependencies: string[];
    storageLocation: string;
    healthStatus: MemoryHealthLevel;
    lastUpdate: string;
    accessPermissions: MemoryAccessPermission[];
    category: MemoryCategory;
    implemented: boolean;
}
export interface MemoryRegistrySnapshot {
    foundationVersion: string;
    storageRoot: string;
    lastUpdated: string;
    modules: MemoryModuleRegistration[];
}
export interface MemoryIntegrityResult {
    verified: boolean;
    checkedPaths: number;
    issues: string[];
    checksumVerified: boolean;
    timestamp: string;
}
export interface MemoryAccessRequest {
    requesterId: string;
    category: MemoryCategory;
    operation: MemoryAccessOperation;
    resourceId?: string;
}
export interface MemoryAccessResult {
    granted: boolean;
    operation: MemoryAccessOperation;
    category: MemoryCategory;
    storagePath: string;
    durationMs: number;
    message: string;
}
export interface MemoryHealthReport {
    level: MemoryHealthLevel;
    score: number;
    availability: boolean;
    storageIntegrity: boolean;
    registryHealth: boolean;
    consistency: boolean;
    readPerformanceMs: number;
    writePerformanceMs: number;
    issues: string[];
    timestamp: string;
}
export interface MemoryFoundationStatusReport {
    foundationStatus: string;
    lifecycleState: MemoryLifecycleState;
    registryStatus: string;
    storageStatus: string;
    persistenceStatus: string;
    integrityStatus: string;
    healthLevel: MemoryHealthLevel;
    registeredModules: number;
    preparedCategories: number;
    performance: {
        startupMs: number;
        averageReadMs: number;
        averageWriteMs: number;
        lastHealthCheckMs: number;
        totalAccessRequests: number;
    };
    protectedCategories: string[];
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MemoryFoundationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map