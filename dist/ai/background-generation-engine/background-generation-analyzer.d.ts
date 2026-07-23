import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import { BackgroundAnalysis, BackgroundGenPlatform, BackgroundGenerationInput, BackgroundGenerationPlan, BackgroundPlanProfile, BackgroundPlatformOptimization, BackgroundReplacementPlan, DepthPlanningPlan, LightingMatchingPlan, ProductionBackgroundInstructions, QualityImprovementPlan, SubjectPreservationPlan } from "./types.js";
export interface BackgroundGenerationContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    brandGuidelines?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    backgroundPrompt?: string;
    sourceImageId?: string;
    productImagePlan?: ProductImageGenerationRecord | null;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class BackgroundGenerationAnalyzer {
    analyzeBackground(context: BackgroundGenerationContext, input: BackgroundGenerationInput): BackgroundAnalysis;
    buildProfile(input: BackgroundGenerationInput, platform: BackgroundGenPlatform, version: number, context: BackgroundGenerationContext, sourceImageId: string): BackgroundPlanProfile;
    buildSubjectPreservation(context: BackgroundGenerationContext): SubjectPreservationPlan;
    buildGenerationPlan(input: BackgroundGenerationInput, profile: BackgroundPlanProfile, context: BackgroundGenerationContext): BackgroundGenerationPlan;
    buildReplacementPlan(profile: BackgroundPlanProfile, input: BackgroundGenerationInput): BackgroundReplacementPlan;
    buildLightingMatching(analysis: BackgroundAnalysis, context: BackgroundGenerationContext): LightingMatchingPlan;
    buildDepthPlanning(analysis: BackgroundAnalysis): DepthPlanningPlan;
    buildQualityImprovement(context: BackgroundGenerationContext): QualityImprovementPlan;
    buildPlatformOptimizations(profile: BackgroundPlanProfile, input: BackgroundGenerationInput): BackgroundPlatformOptimization[];
    buildProductionInstructions(profile: BackgroundPlanProfile, generationPlan: BackgroundGenerationPlan, lightingMatching: LightingMatchingPlan): ProductionBackgroundInstructions;
    buildRecommendations(context: BackgroundGenerationContext, analysis: BackgroundAnalysis): string[];
    resolvePlatform(input: BackgroundGenerationInput): BackgroundGenPlatform;
    resolveSourceImageId(input: BackgroundGenerationInput, context: BackgroundGenerationContext): string | null;
    extractContextFromProduct(analysis: ProductAnalysisIntelligenceRecord | null, understanding: ProductUnderstandingRecord | null, creative: CreativeDirectionRecord | null, strategy: MarketingStrategyRecord | null, input: BackgroundGenerationInput, productImagePlan?: ProductImageGenerationRecord | null): BackgroundGenerationContext | null;
    private describeEnvironment;
    private preservationNote;
    private getPresetNotes;
}
//# sourceMappingURL=background-generation-analyzer.d.ts.map