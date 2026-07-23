/**
 * KWIZERA AI STUDIO — Motion Intelligence Engine types (Step 7G)
 */
export declare enum MotionDirection {
    Static = "static",
    Left = "left",
    Right = "right",
    Up = "up",
    Down = "down",
    Forward = "forward",
    Backward = "backward",
    Circular = "circular",
    Mixed = "mixed"
}
export declare enum MotionSpeed {
    Static = "static",
    Slow = "slow",
    Normal = "normal",
    Fast = "fast",
    VeryFast = "very-fast"
}
export declare enum MotionClassification {
    Static = "static",
    SlowMotion = "slow-motion",
    NormalMotion = "normal-motion",
    FastMotion = "fast-motion",
    Action = "action",
    CinematicMotion = "cinematic-motion",
    PromotionalMotion = "promotional-motion",
    DynamicMotion = "dynamic-motion",
    AnimatedMotion = "animated-motion",
    Other = "other"
}
export declare enum ObjectMotionType {
    ProductMovement = "product-movement",
    HumanMovement = "human-movement",
    VehicleMovement = "vehicle-movement",
    AnimalMovement = "animal-movement",
    BackgroundMotion = "background-motion",
    EnvironmentalMotion = "environmental-motion"
}
export declare enum MotionEventType {
    StartMotion = "start-motion",
    StopMotion = "stop-motion",
    DirectionChange = "direction-change",
    SpeedChange = "speed-change",
    Collision = "collision",
    Interaction = "interaction",
    FocusShift = "focus-shift",
    AttentionShift = "attention-shift"
}
export declare enum TrackingSubjectType {
    Product = "product",
    Human = "human",
    Vehicle = "vehicle",
    Animal = "animal",
    Object = "object",
    Background = "background"
}
export interface MotionAnalysisMetrics {
    presence: boolean;
    direction: MotionDirection;
    speed: MotionSpeed;
    intensity: number;
    durationMs: number;
    continuity: number;
    density: number;
    stability: number;
}
export interface ObjectMotionAnalysis {
    objectId: string;
    type: ObjectMotionType;
    subjectType: TrackingSubjectType;
    shotId: string;
    sceneId: string;
    startMs: number;
    endMs: number;
    direction: MotionDirection;
    speed: MotionSpeed;
    intensity: number;
    confidence: number;
}
export interface SubjectTrack {
    trackId: string;
    subjectType: TrackingSubjectType;
    label: string;
    shotIds: string[];
    sceneIds: string[];
    startMs: number;
    endMs: number;
    entryDetected: boolean;
    exitDetected: boolean;
    reappearanceDetected: boolean;
    trackingAccuracy: number;
    pathSummary: string;
}
export interface MotionEvent {
    eventId: string;
    type: MotionEventType;
    startMs: number;
    endMs: number;
    shotId?: string;
    sceneId?: string;
    trackId?: string;
    description: string;
    confidence: number;
}
export interface MotionTimelineSegment {
    segmentId: string;
    startMs: number;
    endMs: number;
    classification: MotionClassification;
    direction: MotionDirection;
    speed: MotionSpeed;
    intensity: number;
    label: string;
}
export interface MotionPlan {
    motionTimeline: MotionTimelineSegment[];
    motionPath: string;
    motionSynchronization: string;
    motionContinuity: number;
    enhancementNotes: string[];
    aiMotionBlueprint: string;
}
export interface MotionQualityScores {
    motionQualityScore: number;
    motionStabilityScore: number;
    trackingAccuracyScore: number;
    cinematicMotionScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface MotionRecommendation {
    category: "tracking" | "motion" | "planning" | "stability" | "production" | "cinematic";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface MotionRelationships {
    relatedScenes: string[];
    relatedShots: string[];
    relatedCameraMovements: string[];
    relatedTimelines: string[];
    relatedStoryboards: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedKnowledge: string[];
    relatedVideos: string[];
    relatedMemory: string[];
    relatedProjects: string[];
}
export interface MotionIntelligenceInput {
    videoId: string;
    projectId?: string;
    relatedStoryboards?: string[];
    relatedKnowledge?: string[];
    relatedProjects?: string[];
}
export interface MotionIntelligenceRecord {
    videoId: string;
    intelligenceId: string;
    analysisId: string;
    detectionId: string;
    cameraIntelligenceId?: string;
    timelineId?: string;
    metrics: MotionAnalysisMetrics;
    objectMotions: ObjectMotionAnalysis[];
    subjectTracks: SubjectTrack[];
    motionEvents: MotionEvent[];
    classifications: MotionClassification[];
    dominantClassification: MotionClassification;
    motionPlan: MotionPlan;
    scores: MotionQualityScores;
    relationships: MotionRelationships;
    recommendations: MotionRecommendation[];
    keywords: string[];
    validated: boolean;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface MotionIntelligenceResult {
    success: boolean;
    record?: MotionIntelligenceRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface MotionIntelligenceSearchQuery {
    videoId?: string;
    classification?: MotionClassification;
    eventType?: MotionEventType;
    objectType?: ObjectMotionType;
    subjectType?: TrackingSubjectType;
    product?: string;
    brand?: string;
    campaign?: string;
    timelineId?: string;
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface MotionIntelligenceEngineStatusReport {
    engineStatus: string;
    motionAnalysisStatus: string;
    trackingStatus: string;
    classificationStatus: string;
    eventDetectionStatus: string;
    planningStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imageIntelligenceBridgeStatus: string;
    videosProcessed: number;
    totalTracks: number;
    totalEvents: number;
    averageMotionQualityScore: number;
    averageTrackingAccuracyScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MotionIntelligenceEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map