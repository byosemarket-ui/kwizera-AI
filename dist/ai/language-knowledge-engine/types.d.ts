/**
 * KWIZERA AI STUDIO — Language Knowledge Engine types (Step 4J)
 */
export declare enum KnowledgeSupportedLanguage {
    Kinyarwanda = "rw",
    English = "en",
    French = "fr",
    Swahili = "sw",
    Arabic = "ar",
    Spanish = "es",
    Portuguese = "pt",
    German = "de",
    Chinese = "zh",
    Japanese = "ja",
    Future = "future"
}
export declare enum LanguageWritingStyle {
    Formal = "formal",
    Informal = "informal",
    Marketing = "marketing",
    Business = "business",
    Creative = "creative",
    Storytelling = "storytelling",
    Technical = "technical"
}
export declare enum LanguageScriptType {
    Headline = "headline",
    Hook = "hook",
    Cta = "cta",
    ProductDescription = "product-description",
    PromotionalScript = "promotional-script",
    SocialCaption = "social-caption",
    Advertisement = "advertisement",
    EmailMarketing = "email-marketing",
    WebsiteContent = "website-content",
    VoiceOver = "voice-over",
    Narration = "narration",
    Subtitle = "subtitle",
    Caption = "caption"
}
export declare enum LanguageMarketingGoal {
    Conversion = "conversion",
    Awareness = "awareness",
    Engagement = "engagement",
    Education = "education",
    Retention = "retention"
}
export interface LanguageGrammarKnowledge {
    grammarScore: number;
    sentenceStructure: string;
    vocabularyLevel: string;
    tone: string;
    issues: string[];
}
export interface LanguageMarketingKnowledge {
    headlines: string[];
    hooks: string[];
    callToActions: string[];
    productDescriptions: string[];
    promotionalScripts: string[];
    socialCaptions: string[];
    advertisements: string[];
    emailMarketing: string[];
    websiteContent: string[];
}
export interface LanguageVoiceKnowledge {
    voiceOverScripts: string[];
    narrationStyle: string;
    speakingTone: string;
    emotionalTone: string;
    readingSpeed: string;
    subtitleSynchronization: string;
}
export interface LanguageSubtitleKnowledge {
    subtitleText: string[];
    captionText: string[];
    timingMarkers: string[];
    syncQuality: number;
    readabilityOnScreen: number;
}
export interface LanguageLocalizationKnowledge {
    translationReadiness: number;
    localizationReadiness: number;
    relatedLanguages: KnowledgeSupportedLanguage[];
    culturalNotes: string[];
}
export interface LanguageKnowledgeQualityScores {
    grammarScore: number;
    readabilityScore: number;
    marketingScore: number;
    translationReadinessScore: number;
    subtitleQualityScore: number;
    aiConfidenceScore: number;
}
export interface LanguageKnowledgeRelationships {
    relatedLanguages: string[];
    relatedMarketingStyles: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedScripts: string[];
    relatedVideos: string[];
    relatedSubtitles: string[];
}
export interface LanguageKnowledgeRecommendation {
    category: "grammar" | "marketing-style" | "headlines" | "cta" | "storytelling" | "readability" | "localization" | "subtitles";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface LanguageAnalysisInput {
    languageId?: string;
    language: KnowledgeSupportedLanguage;
    detectedLanguage?: KnowledgeSupportedLanguage;
    topic?: string;
    industry?: string;
    brandName?: string;
    productName?: string;
    audience?: string;
    marketingGoal?: LanguageMarketingGoal;
    writingStyle?: LanguageWritingStyle;
    scriptType?: LanguageScriptType;
    content?: string;
    grammar?: Partial<LanguageGrammarKnowledge>;
    marketing?: Partial<LanguageMarketingKnowledge>;
    voice?: Partial<LanguageVoiceKnowledge>;
    subtitles?: Partial<LanguageSubtitleKnowledge>;
    localization?: Partial<LanguageLocalizationKnowledge>;
    tags?: string[];
    keywords?: string[];
    relatedKnowledge?: string[];
    relatedMemory?: string[];
}
export interface LanguageAnalysisRecord {
    languageId: string;
    knowledgeId: string;
    language: KnowledgeSupportedLanguage;
    detectedLanguage: KnowledgeSupportedLanguage;
    topic: string;
    industry: string;
    brandName: string;
    productName: string;
    audience: string;
    marketingGoal: LanguageMarketingGoal;
    writingStyle: LanguageWritingStyle;
    scriptType: LanguageScriptType;
    content: string;
    grammar: LanguageGrammarKnowledge;
    marketing: LanguageMarketingKnowledge;
    voice: LanguageVoiceKnowledge;
    subtitles: LanguageSubtitleKnowledge;
    localization: LanguageLocalizationKnowledge;
    scores: LanguageKnowledgeQualityScores;
    relationships: LanguageKnowledgeRelationships;
    recommendations: LanguageKnowledgeRecommendation[];
    tags: string[];
    keywords: string[];
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface LanguageAnalysisResult {
    success: boolean;
    record?: LanguageAnalysisRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface LanguageSearchQuery {
    language?: KnowledgeSupportedLanguage;
    topic?: string;
    writingStyle?: LanguageWritingStyle;
    marketingGoal?: LanguageMarketingGoal;
    industry?: string;
    brand?: string;
    product?: string;
    audience?: string;
    scriptType?: LanguageScriptType;
    text?: string;
    minGrammarScore?: number;
    limit?: number;
}
export interface LanguageKnowledgeLearningPattern {
    patternId: string;
    patternType: "grammar" | "marketing" | "voice" | "subtitle" | "localization" | "style" | "script";
    description: string;
    sourceLanguageId: string;
    confidence: number;
    detectedAt: string;
}
export interface LanguageKnowledgeStatusReport {
    engineStatus: string;
    grammarStatus: string;
    marketingLanguageStatus: string;
    relationshipStatus: string;
    recordsAnalyzed: number;
    patternsLearned: number;
    averageGrammarScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class LanguageKnowledgeEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map