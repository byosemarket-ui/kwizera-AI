import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { ImageRenderRecord } from "../image-rendering-preparation-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { BrandValidationEntry, ImageQualityValidationEntry, ImageQualityValidationInput, PlatformValidationEntry, PrintValidationEntry, QualityIssue, QualityLayerValidationEntry, QualityMaskValidationEntry, QualityValidationPlatform, QualityValidationProfile, TechnicalValidationEntry, TypographyValidationEntry } from "./types.js";
export interface QualityValidationContext {
    productId?: string;
    productName?: string;
    brandId?: string;
    brandName?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    productionPlan?: ImageProductionRecord | null;
    renderPlan?: ImageRenderRecord | null;
    stylePlan?: MultiStyleImageRecord | null;
    brandingPlan?: BrandingDesignRecord | null;
    analysis?: ProductAnalysisIntelligenceRecord | null;
}
export declare class ImageQualityValidationAnalyzer {
    buildProfile(input: ImageQualityValidationInput, platform: QualityValidationPlatform, version: number, context: QualityValidationContext): QualityValidationProfile;
    buildImageQualityValidation(context: QualityValidationContext, platform: QualityValidationPlatform): ImageQualityValidationEntry[];
    buildLayerValidation(context: QualityValidationContext): QualityLayerValidationEntry[];
    buildMaskValidation(context: QualityValidationContext): QualityMaskValidationEntry[];
    buildTypographyValidation(context: QualityValidationContext): TypographyValidationEntry[];
    buildBrandValidation(context: QualityValidationContext): BrandValidationEntry[];
    buildPrintValidation(context: QualityValidationContext, platform: QualityValidationPlatform): PrintValidationEntry[];
    buildPlatformValidation(input: ImageQualityValidationInput, context: QualityValidationContext): PlatformValidationEntry[];
    buildTechnicalValidation(context: QualityValidationContext): TechnicalValidationEntry[];
    detectIssues(imageQuality: ImageQualityValidationEntry[], layerValidation: QualityLayerValidationEntry[], maskValidation: QualityMaskValidationEntry[], typographyValidation: TypographyValidationEntry[], brandValidation: BrandValidationEntry[], context: QualityValidationContext): QualityIssue[];
    buildRecommendations(context: QualityValidationContext, profile: QualityValidationProfile, issues: QualityIssue[]): string[];
    resolvePlatform(input: ImageQualityValidationInput, context: QualityValidationContext): QualityValidationPlatform;
    extractContext(input: ImageQualityValidationInput, productionPlan?: ImageProductionRecord | null, renderPlan?: ImageRenderRecord | null, stylePlan?: MultiStyleImageRecord | null, brandingPlan?: BrandingDesignRecord | null, analysis?: ProductAnalysisIntelligenceRecord | null): QualityValidationContext;
    private buildPlatformEntry;
    private scoreImageQualityCheck;
    private validateLayerCheck;
    private createIssue;
}
//# sourceMappingURL=image-quality-validation-analyzer.d.ts.map