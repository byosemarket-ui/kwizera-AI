import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AuthorizationValidation, ProductionCloningInstructions, VcPlatform, VoiceAnalysis, VoiceCloningGenerationInput, VoiceCloningPlan, VoiceConsentRecord, VoiceConsistencyPlan, VoiceProfile } from "./types.js";
export interface CloningContext {
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
    sampleHint?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class VoiceCloningGenerationAnalyzer {
    resolveConsent(input: VoiceCloningGenerationInput): VoiceConsentRecord | null;
    validateAuthorization(consent: VoiceConsentRecord | null): AuthorizationValidation;
    analyzeVoice(input: VoiceCloningGenerationInput, context: CloningContext): VoiceAnalysis;
    buildProfile(input: VoiceCloningGenerationInput, platform: VcPlatform, version: number, context: CloningContext, voiceAnalysis: VoiceAnalysis, consent: VoiceConsentRecord, authValidation: AuthorizationValidation): VoiceProfile;
    buildCloningPlan(input: VoiceCloningGenerationInput, context: CloningContext, voiceAnalysis: VoiceAnalysis, profile: VoiceProfile): VoiceCloningPlan;
    buildConsistencyPlan(voiceAnalysis: VoiceAnalysis, cloningPlan: VoiceCloningPlan): VoiceConsistencyPlan;
    buildProductionInstructions(profile: VoiceProfile, consistencyPlan: VoiceConsistencyPlan, cloningPlan: VoiceCloningPlan): ProductionCloningInstructions;
    buildRecommendations(voiceAnalysis: VoiceAnalysis, consistencyPlan: VoiceConsistencyPlan, authValidation: AuthorizationValidation, context: CloningContext): string[];
    resolvePlatform(input: VoiceCloningGenerationInput, context: CloningContext): VcPlatform;
    extractContextFromInput(input: VoiceCloningGenerationInput): CloningContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: VoiceCloningGenerationInput): CloningContext;
    private detectLanguage;
    private estimateSpeakingRate;
    private extractKeywords;
    private extractProperNames;
    private extractTechnicalTerms;
}
//# sourceMappingURL=voice-cloning-generation-analyzer.d.ts.map