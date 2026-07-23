import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import type { ImageQualityValidationRecord } from "../image-quality-validation-engine/types.js";
import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { ImageRenderRecord } from "../image-rendering-preparation-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { ComponentOptimizationPlan, ImageGenerationOptimizationInput, OptimizationPlatform, OptimizationProfile, PerformanceOptimizationPlan, PipelineOptimizationPlan, QualityOptimizationPlan, RecoveryOptimizationPlan, ResourceOptimizationPlan, SearchOptimizationPlan } from "./types.js";
export interface OptimizationContext {
    productId?: string;
    productName?: string;
    brandId?: string;
    brandName?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    validation?: ImageQualityValidationRecord | null;
    productionPlan?: ImageProductionRecord | null;
    renderPlan?: ImageRenderRecord | null;
    stylePlan?: MultiStyleImageRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class ImageGenerationOptimizationAnalyzer {
    buildProfile(input: ImageGenerationOptimizationInput, platform: OptimizationPlatform, version: number, context: OptimizationContext): OptimizationProfile;
    buildComponentOptimization(foundation: AiImageGenerationFoundation, context: OptimizationContext): ComponentOptimizationPlan;
    buildPipelineOptimization(context: OptimizationContext, input: ImageGenerationOptimizationInput): PipelineOptimizationPlan;
    buildResourceOptimization(context: OptimizationContext, input: ImageGenerationOptimizationInput): ResourceOptimizationPlan;
    buildQualityOptimization(context: OptimizationContext, input: ImageGenerationOptimizationInput): QualityOptimizationPlan;
    buildSearchOptimization(input: ImageGenerationOptimizationInput): SearchOptimizationPlan;
    buildRecoveryOptimization(context: OptimizationContext, input: ImageGenerationOptimizationInput): RecoveryOptimizationPlan;
    buildPerformanceOptimization(context: OptimizationContext): PerformanceOptimizationPlan;
    buildRecommendations(profile: OptimizationProfile, context: OptimizationContext): string[];
    resolvePlatform(input: ImageGenerationOptimizationInput, context: OptimizationContext): OptimizationPlatform;
    extractContext(input: ImageGenerationOptimizationInput, validation?: ImageQualityValidationRecord | null, productionPlan?: ImageProductionRecord | null, renderPlan?: ImageRenderRecord | null, stylePlan?: MultiStyleImageRecord | null, analysis?: ProductAnalysisIntelligenceRecord | null): OptimizationContext;
    private pipelineImprovement;
}
//# sourceMappingURL=image-generation-optimization-analyzer.d.ts.map