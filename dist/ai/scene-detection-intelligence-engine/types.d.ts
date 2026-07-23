/**
 * KWIZERA AI STUDIO — Scene Detection Intelligence Engine types (Step 7D)
 */
export declare enum SceneClassification {
    Intro = "intro",
    Hook = "hook",
    ProductDemo = "product-demo",
    BrandScene = "brand-scene",
    Testimonial = "testimonial",
    Cta = "cta",
    Outro = "outro",
    BRoll = "b-roll",
    Other = "other"
}
export declare enum ShotType {
    Wide = "wide",
    Medium = "medium",
    CloseUp = "close-up",
    ExtremeCloseUp = "extreme-close-up",
    Establishing = "establishing",
    Insert = "insert",
    Other = "other"
}
export declare enum TransitionType {
    Cut = "cut",
    Fade = "fade",
    Dissolve = "dissolve",
    Wipe = "wipe",
    ZoomTransition = "zoom-transition",
    Custom = "custom"
}
export declare enum ScenePriority {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low"
}
export interface DetectedScene {
    sceneId: string;
    startMs: number;
    endMs: number;
    durationMs: number;
    order: number;
    classification: SceneClassification;
    priority: ScenePriority;
    purpose: string;
    sceneType: string;
}
export interface DetectedShot {
    shotId: string;
    sceneId: string;
    startMs: number;
    endMs: number;
    durationMs: number;
    shotType: ShotType;
    cameraChange: boolean;
    previousShotId?: string;
    nextShotId?: string;
    relationship: string;
}
export interface DetectedTransition {
    transitionId: string;
    type: TransitionType;
    startMs: number;
    endMs: number;
    durationMs: number;
    fromSceneId: string;
    toSceneId: string;
    fromShotId?: string;
    toShotId?: string;
    label: string;
}
export interface SceneRelationship {
    sceneId: string;
    previousSceneId?: string;
    nextSceneId?: string;
    relatedSceneIds: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedStoryboards: string[];
    relatedScripts: string[];
    timelineId?: string;
}
export interface SceneDetectionIndexes {
    sceneIndexIds: string[];
    shotIndexIds: string[];
    transitionIndexIds: string[];
    timelineIndexIds: string[];
    keyframeIndexIds: string[];
}
export interface SceneDetectionScores {
    sceneDetectionScore: number;
    shotDetectionScore: number;
    transitionScore: number;
    timelineAccuracyScore: number;
    aiConfidenceScore: number;
}
export interface SceneDetectionRecommendation {
    category: "scene" | "shot" | "transition" | "timeline" | "classification";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface SceneDetectionRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedStoryboards: string[];
    relatedScripts: string[];
    relatedKnowledge: string[];
    relatedVideos: string[];
    relatedMemory: string[];
    relatedProjects: string[];
}
export interface SceneDetectionInput {
    videoId: string;
    projectId?: string;
    relatedStoryboards?: string[];
    relatedScripts?: string[];
    relatedKnowledge?: string[];
    relatedProjects?: string[];
}
export interface SceneDetectionRecord {
    videoId: string;
    detectionId: string;
    analysisId: string;
    understandingId?: string;
    scenes: DetectedScene[];
    shots: DetectedShot[];
    transitions: DetectedTransition[];
    sceneRelationships: SceneRelationship[];
    indexes: SceneDetectionIndexes;
    scores: SceneDetectionScores;
    relationships: SceneDetectionRelationships;
    recommendations: SceneDetectionRecommendation[];
    timelineLengthMs: number;
    sceneCount: number;
    shotCount: number;
    transitionCount: number;
    keywords: string[];
    validated: boolean;
    detectedAt: string;
    lastUpdated: string;
    version: number;
}
export interface SceneDetectionResult {
    success: boolean;
    record?: SceneDetectionRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface SceneDetectionSearchQuery {
    videoId?: string;
    sceneId?: string;
    shotId?: string;
    sceneType?: SceneClassification;
    shotType?: ShotType;
    transitionType?: TransitionType;
    product?: string;
    brand?: string;
    campaign?: string;
    timelineId?: string;
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface SceneDetectionEngineStatusReport {
    engineStatus: string;
    sceneDetectionStatus: string;
    shotDetectionStatus: string;
    transitionDetectionStatus: string;
    indexingStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imageIntelligenceBridgeStatus: string;
    videosProcessed: number;
    totalScenesDetected: number;
    totalShotsDetected: number;
    averageSceneDetectionScore: number;
    averageTimelineAccuracyScore: number;
    performance: {
        averageDetectionMs: number;
        averageSearchMs: number;
        averageIndexingMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class SceneDetectionEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map