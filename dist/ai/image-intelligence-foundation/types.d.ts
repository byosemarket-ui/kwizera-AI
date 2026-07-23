/**
 * KWIZERA AI STUDIO — Image Intelligence Foundation types (Step 6A)
 */
export declare enum ImageIntelligenceLifecycleState {
    Initializing = "initializing",
    Loading = "loading",
    Ready = "ready",
    Analyzing = "analyzing",
    Planning = "planning",
    Validating = "validating",
    Optimizing = "optimizing",
    Recovering = "recovering",
    Closing = "closing",
    Closed = "closed"
}
export declare enum ImageIntelligenceCategory {
    ImageAnalysis = "image-analysis",
    ImageUnderstanding = "image-understanding",
    ObjectDetection = "object-detection",
    Background = "background-intelligence",
    Composition = "composition-intelligence",
    LightingColor = "lighting-color-intelligence",
    BrandVisual = "brand-visual-intelligence",
    EnhancementPlanning = "image-enhancement-planning",
    CreativeImage = "creative-image-intelligence",
    ProductionPlanning = "production-image-planning",
    QualityPrediction = "image-quality-prediction",
    Optimization = "image-intelligence-optimization",
    HealthMonitoring = "image-intelligence-health-monitor"
}
export declare enum ImageIntelligenceModuleStatus {
    Prepared = "prepared",
    Registered = "registered",
    Active = "active",
    Disabled = "disabled",
    Validating = "validating",
    Recovering = "recovering",
    Failed = "failed"
}
export declare enum ImageIntelligenceHealthLevel {
    Excellent = "excellent",
    Good = "good",
    Warning = "warning",
    Critical = "critical",
    Failed = "failed"
}
export declare enum ImageIntelligenceSource {
    MemoryEngine = "memory-engine",
    KnowledgeEngine = "knowledge-engine",
    ProductIntelligenceEngine = "product-intelligence-engine",
    ImageKnowledge = "image-knowledge",
    VisualPlanning = "visual-planning",
    CreativeDirection = "creative-direction",
    UserInput = "user-input",
    System = "system",
    Manual = "manual"
}
export declare enum ImageIntelligenceVerificationStatus {
    Unverified = "unverified",
    Pending = "pending",
    Verified = "verified",
    Rejected = "rejected",
    Archived = "archived"
}
export declare enum ImageIntelligenceAccessPermission {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Admin = "admin"
}
export declare enum ImageIntelligenceAccessOperation {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Query = "query"
}
export interface ImageIntelligenceVersionEntry {
    version: number;
    timestamp: string;
    changeSummary: string;
    source: ImageIntelligenceSource;
}
export interface ImageIntelligenceQualityMetadata {
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: ImageIntelligenceVerificationStatus;
    source: ImageIntelligenceSource;
    sourceRef?: string;
    versionHistory: ImageIntelligenceVersionEntry[];
    relationshipLinks: string[];
    healthStatus: ImageIntelligenceHealthLevel;
    lastValidated?: string;
}
export interface ImageIntelligenceModuleRegistration {
    moduleId: string;
    moduleName: string;
    version: string;
    status: ImageIntelligenceModuleStatus;
    dependencies: string[];
    qualityScore: number;
    confidenceScore: number;
    healthStatus: ImageIntelligenceHealthLevel;
    createdAt: string;
    lastUpdated: string;
    accessPermissions: ImageIntelligenceAccessPermission[];
    category: ImageIntelligenceCategory;
    storageLocation: string;
    implemented: boolean;
}
export interface ImageIntelligenceRegistrySnapshot {
    foundationVersion: string;
    storageRoot: string;
    lastUpdated: string;
    modules: ImageIntelligenceModuleRegistration[];
}
export interface ImageIntelligenceIntegrityResult {
    verified: boolean;
    checkedPaths: number;
    issues: string[];
    checksumVerified: boolean;
    timestamp: string;
}
export interface ImageIntelligenceAccessRequest {
    requesterId: string;
    category: ImageIntelligenceCategory;
    operation: ImageIntelligenceAccessOperation;
    resourceId?: string;
}
export interface ImageIntelligenceAccessResult {
    granted: boolean;
    operation: ImageIntelligenceAccessOperation;
    category: ImageIntelligenceCategory;
    storagePath: string;
    durationMs: number;
    message: string;
}
export interface ImageIntelligenceValidationResult {
    valid: boolean;
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: ImageIntelligenceVerificationStatus;
    issues: string[];
    recommendations: string[];
    durationMs: number;
}
export interface ImageIntelligenceHealthReport {
    level: ImageIntelligenceHealthLevel;
    score: number;
    availability: boolean;
    registryHealth: boolean;
    storageIntegrity: boolean;
    qualityValidation: boolean;
    integrationReady: boolean;
    readPerformanceMs: number;
    writePerformanceMs: number;
    issues: string[];
    timestamp: string;
}
export interface ImageIntelligenceIntegrationStatus {
    aiCore: boolean;
    memoryEngine: boolean;
    knowledgeEngine: boolean;
    productIntelligenceEngine: boolean;
    reasoningEngine: boolean;
    planningEngine: boolean;
    decisionEngine: boolean;
    workflowEngine: boolean;
    stateManager: boolean;
    recoveryEngine: boolean;
    healthMonitor: boolean;
    readyCount: number;
    totalCount: number;
}
export interface ImageIntelligenceFoundationStatusReport {
    foundationStatus: string;
    lifecycleState: ImageIntelligenceLifecycleState;
    registryStatus: string;
    storageStatus: string;
    persistenceStatus: string;
    integrityStatus: string;
    healthLevel: ImageIntelligenceHealthLevel;
    integrationStatus: ImageIntelligenceIntegrationStatus;
    registeredModules: number;
    preparedModules: number;
    performance: {
        startupMs: number;
        averageReadMs: number;
        averageWriteMs: number;
        averageValidationMs: number;
        totalAccessRequests: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageIntelligenceFoundationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map