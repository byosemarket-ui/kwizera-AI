/**
 * KWIZERA AI STUDIO — Text-to-Speech Generation Engine types (Step 10B)
 */
export declare enum TtsPlatform {
    Website = "website",
    MobileApp = "mobile-app",
    YouTube = "youtube",
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    Television = "television"
}
export declare enum TtsLanguage {
    English = "en",
    Kinyarwanda = "rw",
    French = "fr",
    Swahili = "sw"
}
export declare enum TtsInputType {
    Text = "text",
    Script = "script",
    SubtitleFile = "subtitle-file",
    ProductInformation = "product-information",
    BrandGuidelines = "brand-guidelines",
    Campaign = "campaign",
    KnowledgeRecord = "knowledge-record"
}
export declare enum TtsOutputUseCase {
    VideoNarration = "video-narration",
    Audiobook = "audiobook",
    Podcast = "podcast",
    Advertisement = "advertisement",
    Presentation = "presentation",
    Elearning = "e-learning",
    CustomerSupport = "customer-support",
    Accessibility = "accessibility"
}
export declare enum VoiceType {
    Male = "male",
    Female = "female",
    Child = "child",
    Elder = "elder",
    Neutral = "neutral",
    Professional = "professional",
    Narrator = "narrator",
    Character = "character"
}
export declare enum EmotionType {
    Neutral = "neutral",
    Happy = "happy",
    Excited = "excited",
    Calm = "calm",
    Serious = "serious",
    Sad = "sad",
    Friendly = "friendly",
    Professional = "professional",
    Inspirational = "inspirational",
    Urgent = "urgent"
}
export interface SpeechPlanProfile {
    speechPlanId: string;
    scriptId: string;
    projectId: string;
    voiceProfileId: string;
    brandId: string;
    campaignId?: string;
    language: TtsLanguage;
    platform: TtsPlatform;
    outputUseCase: TtsOutputUseCase;
    version: number;
}
export interface TextAnalysis {
    language: TtsLanguage;
    grammarNotes: string;
    punctuationNotes: string;
    sentenceCount: number;
    paragraphCount: number;
    keywords: string[];
    numbers: string[];
    dates: string[];
    currencyValues: string[];
    abbreviations: string[];
    properNames: string[];
    technicalTerms: string[];
    wordCount: number;
}
export interface VoicePlan {
    primaryVoice: VoiceType;
    secondaryVoice?: VoiceType;
    voiceDescription: string;
    toneGuidance: string;
    paceGuidance: string;
    brandVoiceAlignment: string;
}
export interface PronunciationPlan {
    phonemeMapping: Record<string, string>;
    pronunciationDictionary: Record<string, string>;
    acronymExpansions: Record<string, string>;
    namePronunciations: Record<string, string>;
    numberReadingRules: string[];
    dateReadingRules: string[];
    currencyReadingRules: string[];
    technicalVocabulary: Record<string, string>;
}
export interface EmotionPlan {
    primaryEmotion: EmotionType;
    secondaryEmotion?: EmotionType;
    emotionIntensity: number;
    emotionalArc: string[];
    sceneEmotionNotes: string[];
}
export interface NaturalnessPlan {
    intonation: string;
    pitch: string;
    speakingRate: string;
    pauses: string[];
    rhythm: string;
    stressPatterns: string[];
    emphasisPoints: string[];
    breathPlanning: string[];
}
export interface PlatformSpeechOptimization {
    platform: TtsPlatform;
    speakingRate: string;
    pauseProfile: string;
    emphasisStyle: string;
    formatNotes: string[];
    optimizationNotes: string[];
}
export interface ProductionSpeechInstructions {
    renderNotes: string[];
    segmentGuidance: string[];
    timingGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface TextToSpeechScores {
    pronunciationScore: number;
    naturalnessScore: number;
    emotionScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface TextToSpeechRelationships {
    scripts: string[];
    voices: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    videos: string[];
    images: string[];
    knowledgeRecords: string[];
    productionPlans: string[];
}
export interface TextToSpeechGenerationInput {
    text?: string;
    script?: string;
    subtitleContent?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: TtsPlatform;
    language?: TtsLanguage;
    outputUseCase?: TtsOutputUseCase;
    voiceProfileId?: string;
    voiceType?: VoiceType;
    emotion?: EmotionType;
    knowledgeRecordIds?: string[];
    generatePlatformOptimizations?: boolean;
    inputTypes?: TtsInputType[];
}
export interface TextToSpeechGenerationRecord {
    speechPlanId: string;
    profile: SpeechPlanProfile;
    textAnalysis: TextAnalysis;
    voicePlan: VoicePlan;
    pronunciationPlan: PronunciationPlan;
    emotionPlan: EmotionPlan;
    naturalnessPlan: NaturalnessPlan;
    platformOptimizations: PlatformSpeechOptimization[];
    productionInstructions: ProductionSpeechInstructions;
    blueprintId?: string;
    scores: TextToSpeechScores;
    relationships: TextToSpeechRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface TextToSpeechGenerationResult {
    success: boolean;
    record?: TextToSpeechGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface TextToSpeechSearchQuery {
    speechPlanId?: string;
    scriptId?: string;
    productId?: string;
    brandId?: string;
    voiceProfileId?: string;
    language?: TtsLanguage;
    platform?: TtsPlatform;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface TextToSpeechGenerationEngineStatusReport {
    engineStatus: string;
    textAnalysisStatus: string;
    pronunciationPlanningStatus: string;
    emotionPlanningStatus: string;
    naturalnessPlanningStatus: string;
    platformOptimizationStatus: string;
    speechPlansGenerated: number;
    averagePronunciationScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averageBlueprintMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class TextToSpeechGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_TTS_PLATFORMS: TtsPlatform[];
export declare const SUPPORTED_TTS_LANGUAGES: TtsLanguage[];
export declare const PLATFORM_SPEECH_CONFIG: Record<TtsPlatform, {
    speakingRate: string;
    pauseProfile: string;
    maxDurationSec: number;
}>;
//# sourceMappingURL=types.d.ts.map