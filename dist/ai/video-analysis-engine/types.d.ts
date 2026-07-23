/**
 * KWIZERA AI STUDIO — Video Analysis Engine types (Step 7B)
 */
export declare enum VideoFileFormat {
    MP4 = "mp4",
    MOV = "mov",
    AVI = "avi",
    MKV = "mkv",
    WebM = "webm",
    MPEG = "mpeg",
    Other = "other"
}
export declare enum VideoContainer {
    MP4 = "mp4",
    QuickTime = "quicktime",
    Matroska = "matroska",
    WebM = "webm",
    AVI = "avi",
    Other = "other"
}
export declare enum VideoCodec {
    H264 = "h264",
    H265 = "h265",
    VP9 = "vp9",
    AV1 = "av1",
    ProRes = "prores",
    Other = "other"
}
export declare enum AudioCodec {
    AAC = "aac",
    MP3 = "mp3",
    PCM = "pcm",
    Opus = "opus",
    AC3 = "ac3",
    Other = "other"
}
export declare enum VideoOrientation {
    Landscape = "landscape",
    Portrait = "portrait",
    Square = "square"
}
export declare enum FrameRateMode {
    Constant = "constant",
    Variable = "variable"
}
export declare enum VideoColorSpace {
    SRGB = "srgb",
    Rec709 = "rec709",
    Rec2020 = "rec2020",
    P3 = "p3",
    Unknown = "unknown"
}
export declare enum VideoAnalysisType {
    Advertisement = "advertisement",
    Commercial = "commercial",
    ProductShowcase = "product-showcase",
    Tutorial = "tutorial",
    SocialMedia = "social-media",
    Documentary = "documentary",
    Presentation = "presentation",
    Interview = "interview",
    Animation = "animation",
    Corporate = "corporate",
    Other = "other"
}
export interface VideoTechnicalProfile {
    videoName: string;
    videoId: string;
    filePath: string;
    fileFormat: VideoFileFormat;
    container: VideoContainer;
    videoCodec: VideoCodec;
    videoCodecProfile: string;
    audioCodec: AudioCodec;
    fileSizeBytes: number;
    durationMs: number;
    resolution: string;
    width: number;
    height: number;
    aspectRatio: string;
    orientation: VideoOrientation;
    fps: number;
    frameRateMode: FrameRateMode;
    bitrateKbps: number;
    hdrSupported: boolean;
    colorSpace: VideoColorSpace;
    metadata: Record<string, string>;
    creationDate?: string;
    lastModifiedDate?: string;
}
export interface VideoFrameAnalysis {
    totalFrames: number;
    keyFrames: number;
    averageFrameIntervalMs: number;
    frameConsistencyScore: number;
    missingFrames: number;
    duplicateFrames: number;
    corruptedFrames: number;
    sceneChangeCandidates: number;
    motionDensity: number;
    visualComplexity: number;
}
export interface TimelineSegment {
    segmentId: string;
    startMs: number;
    endMs: number;
    label: string;
    type: "scene" | "shot" | "segment";
}
export interface VideoTimelineAnalysis {
    timelineLengthMs: number;
    sceneCount: number;
    shotCount: number;
    frameDistribution: Record<string, number>;
    segments: TimelineSegment[];
    sceneDistribution: Record<string, number>;
    shotDistribution: Record<string, number>;
}
export interface VideoAudioTrackAnalysis {
    trackId: string;
    trackName: string;
    language: string;
    sampleRate: number;
    channels: number;
    loudnessDb: number;
    dynamicRangeDb: number;
    audioQualityScore: number;
    syncOffsetMs: number;
    silenceSegments: number;
}
export interface VideoAudioAnalysis {
    tracks: VideoAudioTrackAnalysis[];
    primaryLanguage: string;
    synchronizationScore: number;
    overallAudioQualityScore: number;
}
export interface VideoVisualAnalysis {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    noise: number;
    whiteBalance: number;
    exposure: number;
    dynamicRange: number;
    dominantColors: string[];
    visualStability: number;
}
export interface VideoClassification {
    videoType: VideoAnalysisType;
    category: string;
    subcategory: string;
    creativeStyle: string;
    useCase: string;
}
export interface VideoProductionReadiness {
    editingReadiness: number;
    aiGenerationReadiness: number;
    marketingReadiness: number;
    productionReadiness: number;
    renderingReadiness: number;
    exportReadiness: number;
}
export interface VideoQualityScores {
    technicalQualityScore: number;
    frameQualityScore: number;
    audioQualityScore: number;
    visualQualityScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
    videoCompletenessScore: number;
}
export interface VideoAnalysisRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedImages: string[];
    relatedAudio: string[];
    relatedCampaigns: string[];
    relatedStoryboards: string[];
    relatedCreativeStyles: string[];
    relatedKnowledge: string[];
    relatedVideos: string[];
    relatedMemory: string[];
    relatedProjects: string[];
}
export interface VideoAnalysisIndexes {
    frameIndexIds: string[];
    keyframeIndexIds: string[];
    timelineIndexIds: string[];
    sceneIndexIds: string[];
    audioIndexIds: string[];
    metadataIndexIds: string[];
}
export interface VideoAnalysisRecommendation {
    category: "technical" | "frame" | "audio" | "visual" | "timeline" | "production" | "marketing";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface VideoAnalysisEngineInput {
    videoId?: string;
    videoName?: string;
    filePath?: string;
    fileFormat?: VideoFileFormat;
    container?: VideoContainer;
    videoCodec?: VideoCodec;
    videoCodecProfile?: string;
    audioCodec?: AudioCodec;
    fileSizeBytes?: number;
    durationMs?: number;
    width?: number;
    height?: number;
    fps?: number;
    frameRateMode?: FrameRateMode;
    bitrateKbps?: number;
    hdrSupported?: boolean;
    colorSpace?: VideoColorSpace;
    metadata?: Record<string, string>;
    creationDate?: string;
    lastModifiedDate?: string;
    visual?: Partial<VideoVisualAnalysis>;
    frame?: Partial<VideoFrameAnalysis>;
    timeline?: Partial<VideoTimelineAnalysis>;
    audio?: Partial<VideoAudioAnalysis>;
    videoType?: VideoAnalysisType;
    category?: string;
    subcategory?: string;
    creativeStyle?: string;
    useCase?: string;
    product?: string;
    brand?: string;
    projectId?: string;
    campaign?: string;
    language?: string;
    tags?: string[];
    keywords?: string[];
    relatedKnowledge?: string[];
    relatedMemory?: string[];
    relatedProjects?: string[];
    relatedImages?: string[];
    relatedVideos?: string[];
    sceneCount?: number;
    shotCount?: number;
}
export interface VideoAnalysisIntelligenceRecord {
    videoId: string;
    analysisId: string;
    knowledgeId?: string;
    technical: VideoTechnicalProfile;
    frame: VideoFrameAnalysis;
    timeline: VideoTimelineAnalysis;
    audio: VideoAudioAnalysis;
    visual: VideoVisualAnalysis;
    classification: VideoClassification;
    productionReadiness: VideoProductionReadiness;
    scores: VideoQualityScores;
    relationships: VideoAnalysisRelationships;
    indexes: VideoAnalysisIndexes;
    recommendations: VideoAnalysisRecommendation[];
    missingFields: string[];
    tags: string[];
    keywords: string[];
    validated: boolean;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface VideoAnalysisEngineResult {
    success: boolean;
    record?: VideoAnalysisIntelligenceRecord;
    durationMs: number;
    diagnostics: string[];
    missingFields: string[];
    message?: string;
}
export interface VideoAnalysisSearchQuery {
    videoName?: string;
    videoType?: VideoAnalysisType;
    product?: string;
    brand?: string;
    campaign?: string;
    resolution?: string;
    fps?: number;
    minDurationMs?: number;
    maxDurationMs?: number;
    sceneId?: string;
    frameNumber?: number;
    tags?: string[];
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface VideoAnalysisEngineStatusReport {
    engineStatus: string;
    classificationStatus: string;
    timelineAnalysisStatus: string;
    audioAnalysisStatus: string;
    indexingStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imageIntelligenceBridgeStatus: string;
    videosAnalyzed: number;
    averageCompletenessScore: number;
    averageConfidenceScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageIndexingMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoAnalysisEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map