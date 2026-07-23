import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { ImageRenderInput, ImageRenderPlanProfile, ImageRenderPlatform, LayerValidationEntry, MaskValidationEntry, OutputProfileEntry, RenderAssetValidationEntry, RenderJobPlan, RenderLayerEntry, RenderRecoveryPlan, RenderSettingsPlan, RenderValidationEntry, ResourcePlanningPlan } from "./types.js";
export interface ImageRenderContext {
    productId?: string;
    productName?: string;
    brandId?: string;
    brandName?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    productionId?: string;
    imageId?: string;
    productionPlan?: ImageProductionRecord | null;
    stylePlan?: MultiStyleImageRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class ImageRenderAnalyzer {
    buildProfile(input: ImageRenderInput, platform: ImageRenderPlatform, version: number, context: ImageRenderContext): ImageRenderPlanProfile;
    buildRenderValidation(foundation: AiImageGenerationFoundation): RenderValidationEntry[];
    buildLayerValidation(context: ImageRenderContext, layers: RenderLayerEntry[]): LayerValidationEntry[];
    buildMaskValidation(context: ImageRenderContext): MaskValidationEntry[];
    buildAssetValidation(context: ImageRenderContext, input: ImageRenderInput): RenderAssetValidationEntry[];
    buildLayerStructure(context: ImageRenderContext): RenderLayerEntry[];
    buildRenderSettings(profile: ImageRenderPlanProfile): RenderSettingsPlan;
    buildOutputProfiles(input: ImageRenderInput): OutputProfileEntry[];
    buildResourcePlanning(profile: ImageRenderPlanProfile, input: ImageRenderInput): ResourcePlanningPlan;
    buildRenderJobs(profile: ImageRenderPlanProfile, input: ImageRenderInput): RenderJobPlan[];
    buildRecoveryPlan(profile: ImageRenderPlanProfile, context: ImageRenderContext): RenderRecoveryPlan;
    buildRecommendations(context: ImageRenderContext, profile: ImageRenderPlanProfile): string[];
    resolvePlatform(input: ImageRenderInput, context: ImageRenderContext): ImageRenderPlatform;
    extractContext(input: ImageRenderInput, productionPlan?: ImageProductionRecord | null, stylePlan?: MultiStyleImageRecord | null, analysis?: ProductAnalysisIntelligenceRecord | null): ImageRenderContext;
    private buildOutputProfile;
    private validateLayerCheck;
    private resolveMaskId;
    private resolveAssetId;
    private resolveAssetSource;
}
//# sourceMappingURL=image-render-analyzer.d.ts.map