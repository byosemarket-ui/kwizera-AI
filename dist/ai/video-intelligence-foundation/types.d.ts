/**
 * KWIZERA AI STUDIO — Video Intelligence Foundation types (Step 7A)
 */
export declare enum VideoIntelligenceLifecycleState {
    Initializing = "initializing",
    Loading = "loading",
    Ready = "ready",
    Analyzing = "analyzing",
    Planning = "planning",
    Indexing = "indexing",
    Validating = "validating",
    Optimizing = "optimizing",
    Recovering = "recovering",
    Closing = "closing",
    Closed = "closed"
}
export declare enum VideoIntelligenceCategory {
    VideoAnalysis = "video-analysis",
    VideoUnderstanding = "video-understanding",
    SceneIntelligence = "scene-intelligence",
    TimelineIntelligence = "timeline-intelligence",
    AudioIntelligence = "audio-intelligence",
    SubtitleIntelligence = "subtitle-intelligence",
    MotionIntelligence = "motion-intelligence",
    CameraIntelligence = "camera-intelligence",
    CompositionVideo = "composition-video-intelligence",
    BrandVideo = "brand-video-intelligence",
    EnhancementPlanning = "video-enhancement-planning",
    CreativeVideo = "creative-video-intelligence",
    ProductionPlanning = "production-video-planning",
    QualityPrediction = "video-quality-prediction",
    Optimization = "video-intelligence-optimization",
    HealthMonitoring = "video-intelligence-health-monitor"
}
export declare enum VideoIntelligenceModuleStatus {
    Prepared = "prepared",
    Registered = "registered",
    Active = "active",
    Disabled = "disabled",
    Validating = "validating",
    Recovering = "recovering",
    Failed = "failed"
}
export declare enum VideoIntelligenceHealthLevel {
    Excellent = "excellent",
    Good = "good",
    Warning = "warning",
    Critical = "critical",
    Failed = "failed"
}
export declare enum VideoIntelligenceSource {
    MemoryEngine = "memory-engine",
    KnowledgeEngine = "knowledge-engine",
    ProductIntelligenceEngine = "product-intelligence-engine",
    ImageIntelligenceEngine = "image-intelligence-engine",
    VideoKnowledge = "video-knowledge",
    StoryboardPlanning = "storyboard-planning",
    CreativeDirection = "creative-direction",
    UserInput = "user-input",
    System = "system",
    Manual = "manual"
}
export declare enum VideoIntelligenceVerificationStatus {
    Unverified = "unverified",
    Pending = "pending",
    Verified = "verified",
    Rejected = "rejected",
    Archived = "archived"
}
export declare enum VideoIntelligenceAccessPermission {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Admin = "admin"
}
export declare enum VideoIntelligenceAccessOperation {
    Read = "read",
    Write = "write",
    Update = "update",
    Delete = "delete",
    Validate = "validate",
    Query = "query"
}
export declare enum VideoAssetType {
    OriginalVideo = "original-video",
    ProxyVideo = "proxy-video",
    RenderedVideo = "rendered-video",
    AudioTrack = "audio-track",
    VoiceTrack = "voice-track",
    Music = "music",
    SoundEffect = "sound-effect",
    Subtitle = "subtitle",
    Caption = "caption",
    Transition = "transition",
    Effect = "effect",
    LUT = "lut",
    MotionGraphic = "motion-graphic",
    Overlay = "overlay",
    Logo = "logo",
    Template = "template",
    ExportProfile = "export-profile"
}
export declare enum VideoIndexType {
    Frame = "frame",
    Keyframe = "keyframe",
    Scene = "scene",
    Timeline = "timeline",
    Shot = "shot",
    Sequence = "sequence"
}
export declare enum VideoAspectRatio {
    Landscape16x9 = "16:9",
    Portrait9x16 = "9:16",
    Square1x1 = "1:1",
    Cinema21x9 = "21:9",
    Custom = "custom"
}
export declare enum VideoWorkflowActionType {
    Edit = "edit",
    Trim = "trim",
    Overlay = "overlay",
    AudioMix = "audio-mix",
    SubtitleEdit = "subtitle-edit",
    ColorGrade = "color-grade",
    Transition = "transition",
    Restore = "restore"
}
export interface VideoIntelligenceVersionEntry {
    version: number;
    timestamp: string;
    changeSummary: string;
    source: VideoIntelligenceSource;
}
export interface VideoIntelligenceQualityMetadata {
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: VideoIntelligenceVerificationStatus;
    source: VideoIntelligenceSource;
    sourceRef?: string;
    versionHistory: VideoIntelligenceVersionEntry[];
    relationshipLinks: string[];
    healthStatus: VideoIntelligenceHealthLevel;
    lastValidated?: string;
}
export interface VideoIntelligenceModuleRegistration {
    moduleId: string;
    moduleName: string;
    version: string;
    status: VideoIntelligenceModuleStatus;
    dependencies: string[];
    qualityScore: number;
    confidenceScore: number;
    healthStatus: VideoIntelligenceHealthLevel;
    createdAt: string;
    lastUpdated: string;
    accessPermissions: VideoIntelligenceAccessPermission[];
    category: VideoIntelligenceCategory;
    storageLocation: string;
    implemented: boolean;
}
export interface VideoIntelligenceRegistrySnapshot {
    foundationVersion: string;
    storageRoot: string;
    lastUpdated: string;
    modules: VideoIntelligenceModuleRegistration[];
}
export interface VideoIntelligenceIntegrityResult {
    verified: boolean;
    checkedPaths: number;
    issues: string[];
    checksumVerified: boolean;
    timestamp: string;
}
export interface VideoIntelligenceAccessRequest {
    requesterId: string;
    category: VideoIntelligenceCategory;
    operation: VideoIntelligenceAccessOperation;
    resourceId?: string;
}
export interface VideoIntelligenceAccessResult {
    granted: boolean;
    operation: VideoIntelligenceAccessOperation;
    category: VideoIntelligenceCategory;
    storagePath: string;
    durationMs: number;
    message: string;
}
export interface VideoIntelligenceValidationResult {
    valid: boolean;
    qualityScore: number;
    confidenceScore: number;
    verificationStatus: VideoIntelligenceVerificationStatus;
    issues: string[];
    recommendations: string[];
    durationMs: number;
}
export interface VideoIntelligenceHealthReport {
    level: VideoIntelligenceHealthLevel;
    score: number;
    availability: boolean;
    registryHealth: boolean;
    storageIntegrity: boolean;
    assetRegistryHealth: boolean;
    frameIndexHealth: boolean;
    workflowHealth: boolean;
    qualityValidation: boolean;
    integrationReady: boolean;
    readPerformanceMs: number;
    writePerformanceMs: number;
    indexLookupMs: number;
    issues: string[];
    timestamp: string;
}
export interface VideoIntelligenceIntegrationStatus {
    aiCore: boolean;
    memoryEngine: boolean;
    knowledgeEngine: boolean;
    productIntelligenceEngine: boolean;
    imageIntelligenceEngine: boolean;
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
export interface VideoIntelligenceFoundationStatusReport {
    foundationStatus: string;
    lifecycleState: VideoIntelligenceLifecycleState;
    registryStatus: string;
    storageStatus: string;
    persistenceStatus: string;
    integrityStatus: string;
    healthLevel: VideoIntelligenceHealthLevel;
    integrationStatus: VideoIntelligenceIntegrationStatus;
    registeredModules: number;
    preparedModules: number;
    assetCount: number;
    projectCount: number;
    indexedFrames: number;
    performance: {
        startupMs: number;
        averageReadMs: number;
        averageWriteMs: number;
        averageValidationMs: number;
        averageIndexLookupMs: number;
        totalAccessRequests: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export interface VideoAssetRegistration {
    assetId: string;
    assetType: VideoAssetType;
    assetName: string;
    projectId: string;
    videoId?: string;
    timelineId?: string;
    filePath?: string;
    durationMs?: number;
    language?: string;
    aspectRatio?: VideoAspectRatio;
    quality: VideoIntelligenceQualityMetadata;
    relationshipLinks: string[];
    originalAssetId?: string;
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface VideoFrameIndexEntry {
    indexId: string;
    indexType: VideoIndexType;
    projectId: string;
    videoId: string;
    timelineId?: string;
    frameNumber?: number;
    timecodeMs?: number;
    sceneId?: string;
    shotId?: string;
    sequenceId?: string;
    keyframe?: boolean;
    label?: string;
    relationshipLinks: string[];
    createdAt: string;
}
export interface VideoTimelineRegistration {
    timelineId: string;
    projectId: string;
    videoId: string;
    timelineName: string;
    durationMs: number;
    frameRate: number;
    aspectRatio: VideoAspectRatio;
    language?: string;
    audioTrackIds: string[];
    subtitleTrackIds: string[];
    sceneIds: string[];
    deliverableIds: string[];
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface VideoSceneRegistration {
    sceneId: string;
    projectId: string;
    videoId: string;
    timelineId: string;
    sceneName: string;
    startMs: number;
    endMs: number;
    shotIds: string[];
    cameraIds: string[];
    relationshipLinks: string[];
    version: number;
    createdAt: string;
}
export interface VideoProjectRegistration {
    projectId: string;
    projectName: string;
    description?: string;
    videoIds: string[];
    timelineIds: string[];
    deliverableIds: string[];
    platformVersions: string[];
    languages: string[];
    aspectRatios: VideoAspectRatio[];
    batchProcessingEnabled: boolean;
    quality: VideoIntelligenceQualityMetadata;
    version: number;
    createdAt: string;
    lastUpdated: string;
}
export interface VideoWorkflowEditEntry {
    editId: string;
    projectId: string;
    videoId: string;
    timelineId?: string;
    actionType: VideoWorkflowActionType;
    summary: string;
    beforeStateRef: string;
    afterStateRef: string;
    reversible: boolean;
    timestamp: string;
    version: number;
}
export interface VideoWorkflowState {
    projectId: string;
    videoId: string;
    originalPreserved: boolean;
    currentVersion: number;
    undoStack: string[];
    redoStack: string[];
    editHistory: VideoWorkflowEditEntry[];
    lastUpdated: string;
}
export declare class VideoIntelligenceFoundationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map