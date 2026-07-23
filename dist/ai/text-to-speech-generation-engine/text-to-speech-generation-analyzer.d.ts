import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { EmotionPlan, NaturalnessPlan, PlatformSpeechOptimization, PronunciationPlan, ProductionSpeechInstructions, SpeechPlanProfile, TextAnalysis, TextToSpeechGenerationInput, TtsPlatform, VoicePlan } from "./types.js";
export interface SpeechContext {
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
    textContent?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class TextToSpeechGenerationAnalyzer {
    analyzeText(input: TextToSpeechGenerationInput, context: SpeechContext): TextAnalysis;
    buildProfile(input: TextToSpeechGenerationInput, platform: TtsPlatform, version: number, context: SpeechContext, textAnalysis: TextAnalysis): SpeechPlanProfile;
    buildVoicePlan(input: TextToSpeechGenerationInput, context: SpeechContext, textAnalysis: TextAnalysis): VoicePlan;
    buildPronunciationPlan(textAnalysis: TextAnalysis, context: SpeechContext): PronunciationPlan;
    buildEmotionPlan(input: TextToSpeechGenerationInput, context: SpeechContext, textAnalysis: TextAnalysis): EmotionPlan;
    buildNaturalnessPlan(textAnalysis: TextAnalysis, voicePlan: VoicePlan, platform: TtsPlatform): NaturalnessPlan;
    buildPlatformOptimizations(profile: SpeechPlanProfile, input: TextToSpeechGenerationInput): PlatformSpeechOptimization[];
    buildProductionInstructions(profile: SpeechPlanProfile, naturalnessPlan: NaturalnessPlan, voicePlan: VoicePlan): ProductionSpeechInstructions;
    buildRecommendations(textAnalysis: TextAnalysis, emotionPlan: EmotionPlan, context: SpeechContext): string[];
    resolvePlatform(input: TextToSpeechGenerationInput, context: SpeechContext): TtsPlatform;
    extractContextFromInput(input: TextToSpeechGenerationInput): SpeechContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: TextToSpeechGenerationInput): SpeechContext;
    private resolveTextContent;
    private detectLanguage;
    private analyzeGrammar;
    private analyzePunctuation;
    private extractKeywords;
    private extractNumbers;
    private extractDates;
    private extractCurrency;
    private extractAbbreviations;
    private extractProperNames;
    private extractTechnicalTerms;
    private phoneticHint;
}
//# sourceMappingURL=text-to-speech-generation-analyzer.d.ts.map