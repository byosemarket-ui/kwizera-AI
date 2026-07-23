/**
 * KWIZERA AI STUDIO — Voice Cloning Generation Engine types (Step 10D)
 */
import { EmotionType, VoiceType } from "../text-to-speech-generation-engine/types.js";
import { AccentType } from "../speech-to-speech-generation-engine/types.js";
export declare enum VcPlatform {
    Website = "website",
    MobileApp = "mobile-app",
    YouTube = "youtube",
    TikTok = "tiktok",
    Instagram = "instagram",
    Facebook = "facebook",
    Television = "television"
}
export declare enum VcLanguage {
    English = "en",
    Kinyarwanda = "rw",
    French = "fr",
    Swahili = "sw"
}
export declare enum VcInputType {
    VoiceSample = "voice-sample",
    VoiceConsent = "voice-consent",
    VoiceMetadata = "voice-metadata",
    BrandGuidelines = "brand-guidelines",
    Campaign = "campaign",
    KnowledgeRecord = "knowledge-record"
}
export declare enum VcOutputUseCase {
    VideoNarration = "video-narration",
    Audiobook = "audiobook",
    Podcast = "podcast",
    Advertisement = "advertisement",
    CustomerSupport = "customer-support",
    Elearning = "e-learning",
    Accessibility = "accessibility"
}
export declare enum VoiceLibraryType {
    Professional = "professional",
    Narrator = "narrator",
    Character = "character",
    Corporate = "corporate",
    Educational = "educational",
    Commercial = "commercial",
    CustomAuthorized = "custom-authorized"
}
export declare enum AuthorizationStatus {
    Authorized = "authorized",
    Pending = "pending",
    Expired = "expired",
    Revoked = "revoked",
    Unauthorized = "unauthorized"
}
export interface VoiceConsentRecord {
    consentId: string;
    speakerId: string;
    granted: boolean;
    usagePermission: string;
    projectAuthorization: boolean;
    licensingStatus: string;
    expiresAt?: string;
}
export interface VoiceMetadata {
    speakerName?: string;
    gender?: string;
    ageRange?: string;
    recordingQuality?: string;
    sampleDurationMs?: number;
    sampleCount?: number;
    notes?: string;
}
export interface VoiceProfile {
    voiceProfileId: string;
    projectId: string;
    speakerId: string;
    brandId: string;
    campaignId?: string;
    language: VcLanguage;
    voiceVersion: number;
    authorizationStatus: AuthorizationStatus;
    voiceLibraryType: VoiceLibraryType;
    voiceType: VoiceType;
    sampleId: string;
    consentId: string;
    platform: VcPlatform;
    outputUseCase: VcOutputUseCase;
}
export interface VoiceAnalysis {
    language: VcLanguage;
    pitch: string;
    timbre: string;
    tone: string;
    speakingRate: string;
    rhythm: string;
    pronunciation: string;
    accent: AccentType;
    detectedEmotion: EmotionType;
    voiceQualityScore: number;
    backgroundNoiseLevel: string;
    durationMs: number;
    keywords: string[];
    properNames: string[];
    technicalTerms: string[];
}
export interface VoiceCloningPlan {
    voiceIdentityMapping: Record<string, string>;
    voiceStyleMapping: Record<string, string>;
    accentMapping: string;
    pronunciationMapping: Record<string, string>;
    emotionMapping: Record<string, string>;
    prosodyMapping: string;
    speakingRateMapping: string;
    pausePlanning: string[];
    brandVoiceAlignment: string;
}
export interface VoiceConsistencyPlan {
    voiceIdentity: string;
    voiceStyle: string;
    accent: string;
    pronunciation: string;
    emotion: string;
    naturalRhythm: string;
    speakingPace: string;
    voiceStability: string;
    consistencyScore: number;
}
export interface AuthorizationValidation {
    voiceConsentValid: boolean;
    usagePermissionValid: boolean;
    projectAuthorizationValid: boolean;
    licensingValid: boolean;
    expirationValid: boolean;
    overallAuthorized: boolean;
    authorizationStatus: AuthorizationStatus;
    validationNotes: string[];
}
export interface ProductionCloningInstructions {
    renderNotes: string[];
    identityGuidance: string[];
    stabilityGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface VoiceCloningScores {
    voiceSimilarityScore: number;
    voiceStabilityScore: number;
    pronunciationScore: number;
    emotionPreservationScore: number;
    productionReadinessScore: number;
    authorizationComplianceScore: number;
    brandConsistencyScore: number;
    aiConfidenceScore: number;
}
export interface VoiceCloningRelationships {
    voiceSamples: string[];
    voiceProfiles: string[];
    consentRecords: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    videos: string[];
    knowledgeRecords: string[];
    productionPlans: string[];
}
export interface VoiceCloningGenerationInput {
    voiceSampleId?: string;
    voiceSampleRef?: string;
    consentId?: string;
    voiceConsent?: VoiceConsentRecord;
    speakerId?: string;
    voiceMetadata?: VoiceMetadata;
    voiceLibraryType?: VoiceLibraryType;
    voiceType?: VoiceType;
    sourceAccent?: AccentType;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    brandGuidelines?: string;
    platform?: VcPlatform;
    language?: VcLanguage;
    outputUseCase?: VcOutputUseCase;
    sourceEmotion?: EmotionType;
    durationMs?: number;
    sampleHint?: string;
    knowledgeRecordIds?: string[];
    inputTypes?: VcInputType[];
}
export interface VoiceCloningGenerationRecord {
    cloningPlanId: string;
    profile: VoiceProfile;
    voiceAnalysis: VoiceAnalysis;
    cloningPlan: VoiceCloningPlan;
    consistencyPlan: VoiceConsistencyPlan;
    authorizationValidation: AuthorizationValidation;
    productionInstructions: ProductionCloningInstructions;
    blueprintId?: string;
    scores: VoiceCloningScores;
    relationships: VoiceCloningRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    authorizationCompliant: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface VoiceCloningGenerationResult {
    success: boolean;
    record?: VoiceCloningGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VoiceCloningSearchQuery {
    cloningPlanId?: string;
    voiceProfileId?: string;
    voiceSampleId?: string;
    speakerId?: string;
    productId?: string;
    brandId?: string;
    language?: VcLanguage;
    platform?: VcPlatform;
    authorizationStatus?: AuthorizationStatus;
    voiceLibraryType?: VoiceLibraryType;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface VoiceCloningGenerationEngineStatusReport {
    engineStatus: string;
    voiceAnalysisStatus: string;
    authorizationValidationStatus: string;
    voiceProfileStatus: string;
    voiceConsistencyStatus: string;
    voiceLibraryStatus: string;
    cloningPlansGenerated: number;
    averageVoiceSimilarityScore: number;
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
export declare class VoiceCloningGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_VC_PLATFORMS: VcPlatform[];
export declare const SUPPORTED_VC_LANGUAGES: VcLanguage[];
export declare const VOICE_LIBRARY_TYPES: VoiceLibraryType[];
export declare const PLATFORM_VC_CONFIG: Record<VcPlatform, {
    speakingRate: string;
    pauseProfile: string;
    maxDurationSec: number;
}>;
//# sourceMappingURL=types.d.ts.map