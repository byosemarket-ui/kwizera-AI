/**
 * KWIZERA AI STUDIO — Video Knowledge Engine types (Step 4F)
 */
export declare enum VideoType {
    Promotional = "promotional",
    Product = "product",
    Marketing = "marketing",
    Brand = "brand",
    Tutorial = "tutorial",
    Social = "social",
    Commercial = "commercial",
    Cinematic = "cinematic"
}
export declare enum EditingStyle {
    Cinematic = "cinematic",
    Commercial = "commercial",
    FastPaced = "fast-paced",
    Minimal = "minimal",
    Documentary = "documentary"
}
export declare enum CameraShotType {
    Static = "static",
    Pan = "pan",
    Tilt = "tilt",
    Zoom = "zoom",
    Dolly = "dolly",
    Tracking = "tracking",
    Orbit = "orbit",
    CloseUp = "close-up",
    Medium = "medium",
    Wide = "wide",
    ProductShowcase = "product-showcase"
}
export interface SceneKnowledge {
    sceneOrder: number;
    sceneDuration: number;
    scenePurpose: string;
    productVisibility: number;
    focusArea: string;
    background: string;
    composition: string;
    motion: string;
    cameraMovement: CameraShotType | string;
    transition: string;
    textPlacement: string;
    ctaPlacement: string;
}
export interface VideoStructureKnowledge {
    sceneSequence: SceneKnowledge[];
    storyFlow: string;
    intro: string;
    outro: string;
    totalDuration: number;
    aspectRatio: string;
    resolution: string;
}
export interface CameraKnowledge {
    primaryShots: CameraShotType[];
    cameraAngles: string[];
    cameraMotion: string;
    productShowcase: boolean;
}
export interface EditingKnowledge {
    editingRhythm: string;
    transitionTiming: string;
    sceneFlow: string;
    motionConsistency: number;
    visualContinuity: number;
    editingStyle: EditingStyle;
    transitionTechniques: string[];
}
export interface AudioKnowledge {
    backgroundMusic: string;
    voiceOver: string;
    narration: string;
    audioBalance: number;
    soundEffects: string[];
    beatSynchronization: number;
    audioTransitions: string;
    audioQuality: number;
}
export interface MarketingKnowledge {
    hookTiming: number;
    productIntroduction: number;
    valueProposition: string;
    customerAttention: number;
    emotionalFlow: string;
    callToActionPlacement: string;
    closingStrategy: string;
    marketingGoal: string;
}
export interface VisualProductionKnowledge {
    productPresentation: string;
    lighting: string;
    colorGrading: string;
    motionGraphics: string;
    visualEffects: string;
    textAnimation: string;
    subtitleTiming: string;
    logoAnimation: string;
    brandingConsistency: number;
}
export interface VideoQualityScores {
    storytellingScore: number;
    editingScore: number;
    marketingScore: number;
    visualScore: number;
    audioScore: number;
    brandConsistencyScore: number;
    aiConfidenceScore: number;
}
export interface VideoRelationships {
    similarVideos: string[];
    similarProducts: string[];
    similarCampaigns: string[];
    similarStyles: string[];
    similarEditing: string[];
    similarMusic: string[];
    similarStorytelling: string[];
}
export interface VideoRecommendation {
    category: "scene-order" | "camera-movement" | "transitions" | "audio" | "storytelling" | "branding" | "cta" | "structure";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface VideoAnalysisInput {
    videoId?: string;
    videoPath: string;
    videoName: string;
    videoType?: VideoType;
    duration?: number;
    resolution?: string;
    aspectRatio?: string;
    product?: string;
    brandName?: string;
    category?: string;
    language?: string;
    marketingGoal?: string;
    structure?: Partial<VideoStructureKnowledge>;
    camera?: Partial<CameraKnowledge>;
    editing?: Partial<EditingKnowledge>;
    audio?: Partial<AudioKnowledge>;
    marketing?: Partial<MarketingKnowledge>;
    visual?: Partial<VisualProductionKnowledge>;
    scenes?: Partial<SceneKnowledge>[];
    tags?: string[];
    keywords?: string[];
    relatedKnowledge?: string[];
    relatedMemory?: string[];
}
export interface VideoAnalysisRecord {
    videoId: string;
    knowledgeId: string;
    videoPath: string;
    videoName: string;
    videoType: VideoType;
    productName: string;
    brandName: string;
    structure: VideoStructureKnowledge;
    camera: CameraKnowledge;
    editing: EditingKnowledge;
    audio: AudioKnowledge;
    marketing: MarketingKnowledge;
    visual: VisualProductionKnowledge;
    scores: VideoQualityScores;
    relationships: VideoRelationships;
    recommendations: VideoRecommendation[];
    tags: string[];
    keywords: string[];
    language: string;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface VideoAnalysisResult {
    success: boolean;
    record?: VideoAnalysisRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VideoSearchQuery {
    videoType?: VideoType;
    product?: string;
    brand?: string;
    sceneType?: string;
    editingStyle?: EditingStyle;
    cameraStyle?: CameraShotType;
    animation?: string;
    transition?: string;
    music?: string;
    language?: string;
    marketingGoal?: string;
    minStorytelling?: number;
    text?: string;
    limit?: number;
}
export interface VideoLearningPattern {
    patternId: string;
    patternType: "scene-structure" | "editing" | "marketing" | "audio" | "storytelling" | "camera";
    description: string;
    sourceVideoId: string;
    confidence: number;
    detectedAt: string;
}
export interface VideoKnowledgeStatusReport {
    engineStatus: string;
    sceneAnalysisStatus: string;
    editingKnowledgeStatus: string;
    marketingKnowledgeStatus: string;
    relationshipStatus: string;
    videosAnalyzed: number;
    patternsLearned: number;
    averageStorytellingScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoKnowledgeEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map