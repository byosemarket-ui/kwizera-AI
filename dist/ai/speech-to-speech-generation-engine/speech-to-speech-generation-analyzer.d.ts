import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { EmotionPreservationPlan, PlatformSpeechOptimization, PronunciationAdaptationPlan, ProductionTransformationInstructions, S2sPlatform, SpeechAnalysis, SpeechToSpeechGenerationInput, SpeechTransformationProfile, TimingPreservationPlan, VoiceTransformationPlan } from "./types.js";
export interface TransformationContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    targetAudience?: string;
    keyBenefit?: string;
    industry?: string;
    transcriptHint?: string;
    sourceAudioRef?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class SpeechToSpeechGenerationAnalyzer {
    analyzeSpeech(input: SpeechToSpeechGenerationInput, context: TransformationContext): SpeechAnalysis;
    buildProfile(input: SpeechToSpeechGenerationInput, platform: S2sPlatform, version: number, context: TransformationContext, speechAnalysis: SpeechAnalysis): SpeechTransformationProfile;
    buildVoiceTransformation(input: SpeechToSpeechGenerationInput, context: TransformationContext, speechAnalysis: SpeechAnalysis): VoiceTransformationPlan;
    buildEmotionPreservation(input: SpeechToSpeechGenerationInput, speechAnalysis: SpeechAnalysis): EmotionPreservationPlan;
    buildPronunciationAdaptation(speechAnalysis: SpeechAnalysis, context: TransformationContext): PronunciationAdaptationPlan;
    buildTimingPreservation(speechAnalysis: SpeechAnalysis): TimingPreservationPlan;
    buildPlatformOptimizations(profile: SpeechTransformationProfile, input: SpeechToSpeechGenerationInput): PlatformSpeechOptimization[];
    buildProductionInstructions(profile: SpeechTransformationProfile, timingPlan: TimingPreservationPlan, voicePlan: VoiceTransformationPlan): ProductionTransformationInstructions;
    buildRecommendations(speechAnalysis: SpeechAnalysis, emotionPlan: EmotionPreservationPlan, context: TransformationContext): string[];
    resolvePlatform(input: SpeechToSpeechGenerationInput, context: TransformationContext): S2sPlatform;
    extractContextFromInput(input: SpeechToSpeechGenerationInput): TransformationContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: SpeechToSpeechGenerationInput): TransformationContext;
    private buildSpeakerSegments;
    private detectLanguage;
    private estimateSpeakingRate;
    private extractKeywords;
    private extractProperNames;
    private extractTechnicalTerms;
}
//# sourceMappingURL=speech-to-speech-generation-analyzer.d.ts.map