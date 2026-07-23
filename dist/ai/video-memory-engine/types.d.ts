/**
 * KWIZERA AI STUDIO — Video Memory Engine types (Step 3G)
 */
export declare enum VideoStatus {
    Draft = "draft",
    InProduction = "in-production",
    Editing = "editing",
    Completed = "completed",
    Exported = "exported",
    Archived = "archived"
}
export interface SceneMemory {
    sceneOrder: number;
    sceneDuration: number;
    scenePurpose: string;
    productFocus: string;
    background: string;
    cameraMovement: string;
    animationStyle: string;
    visualEffects: string;
    transitionType: string;
    textPlacement: string;
    subtitleStyle: string;
}
export interface AudioMemory {
    backgroundMusic: string;
    voiceStyle: string;
    voiceLanguage: string;
    narration: string;
    soundEffects: string[];
    audioTiming: string;
    audioQuality: string;
}
export interface MarketingMemory {
    hook: string;
    callToAction: string;
    sellingPoints: string[];
    emotionalStrategy: string;
    brandingStyle: string;
    productPresentationStyle: string;
    marketingStructure: string;
}
export interface VisualMemory {
    productPosition: string;
    lightingStyle: string;
    colorPalette: string[];
    typography: string;
    iconStyle: string;
    motionStyle: string;
    introStyle: string;
    outroStyle: string;
    logoAnimation: string;
}
export interface VideoQualityScores {
    videoQualityScore: number;
    marketingScore: number;
    aiConfidenceScore: number;
    learningScore: number;
    userSatisfaction: number;
    exportQuality: number;
}
export interface VideoExportRecord {
    exportId: string;
    format: string;
    resolution: string;
    timestamp: string;
    path?: string;
}
export interface VideoPattern {
    patternId: string;
    patternType: "scene-structure" | "transition" | "product-presentation" | "marketing-flow" | "animation" | "branding";
    description: string;
    sourceVideoId: string;
    confidence: number;
    reusable: boolean;
    detectedAt: string;
}
export interface VideoVersionInfo {
    version: number;
    timestamp: string;
    changeSummary: string;
    memoryVersion: number;
}
export interface VideoCreateInput {
    videoId?: string;
    projectId: string;
    videoName: string;
    productType?: string;
    brand?: string;
    category?: string;
    targetAudience?: string;
    marketingGoal?: string;
    language?: string;
    duration?: number;
    resolution?: string;
    aspectRatio?: string;
    exportFormat?: string;
    scenes?: SceneMemory[];
    audio?: Partial<AudioMemory>;
    marketing?: Partial<MarketingMemory>;
    visual?: Partial<VisualMemory>;
    tags?: string[];
    keywords?: string[];
}
export interface VideoUpdateInput {
    videoName?: string;
    status?: VideoStatus;
    productType?: string;
    brand?: string;
    category?: string;
    targetAudience?: string;
    marketingGoal?: string;
    language?: string;
    duration?: number;
    resolution?: string;
    aspectRatio?: string;
    exportFormat?: string;
    scenes?: SceneMemory[];
    scenesAppend?: SceneMemory[];
    audio?: Partial<AudioMemory>;
    marketing?: Partial<MarketingMemory>;
    visual?: Partial<VisualMemory>;
    exportRecord?: VideoExportRecord;
    userSatisfaction?: number;
    tags?: string[];
    keywords?: string[];
    lessonsLearned?: string[];
    strengths?: string[];
    weaknesses?: string[];
}
export interface VideoRecord {
    videoId: string;
    memoryId: string;
    projectId: string;
    videoName: string;
    productType: string;
    brand: string;
    category: string;
    targetAudience: string;
    marketingGoal: string;
    language: string;
    duration: number;
    resolution: string;
    aspectRatio: string;
    exportFormat: string;
    status: VideoStatus;
    creationDate: string;
    lastModified: string;
    scenes: SceneMemory[];
    audio: AudioMemory;
    marketing: MarketingMemory;
    visual: VisualMemory;
    scores: VideoQualityScores;
    exportHistory: VideoExportRecord[];
    patterns: VideoPattern[];
    relatedMemories: string[];
    lessonsLearned: string[];
    strengths: string[];
    weaknesses: string[];
    versions: VideoVersionInfo[];
    tags: string[];
    keywords: string[];
}
export interface VideoProcessResult {
    success: boolean;
    videoId: string;
    memoryId: string;
    version: number;
    durationMs: number;
    patternsDetected: number;
    reason?: string;
}
export interface VideoLearningResult {
    success: boolean;
    videoId: string;
    patternsStored: number;
    learningId?: string;
    strengths: string[];
    weaknesses: string[];
}
export interface VideoRelationships {
    similarVideos: string[];
    similarProducts: string[];
    similarMarketing: string[];
    similarBrands: string[];
    similarStyles: string[];
    similarAudiences: string[];
    relatedMemories: string[];
}
export interface VideoMemoryStatusReport {
    engineStatus: string;
    patternDetectionStatus: string;
    relationshipStatus: string;
    totalVideos: number;
    totalPatterns: number;
    searchPerformance: {
        averageSearchMs: number;
        lastSearchMs: number;
    };
    storageIntegrity: string;
    performance: {
        averageSaveMs: number;
        averageLoadMs: number;
        totalVersions: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoMemoryEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map