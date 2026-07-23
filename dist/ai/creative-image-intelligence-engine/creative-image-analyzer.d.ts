import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { CreativeImageProfile, CreativeImageRecommendation, CreativeLayoutType, CreativeImagePlatform, CreativeProductionInstructions, CreativeStyleCategory, CreativeStylePlanning, LayoutPlanning, MarketingLayoutType, MarketingPreparation, PlatformPreparation } from "./types.js";
export declare class CreativeImageAnalyzer {
    buildFromIntelligence(analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, composition: CompositionIntelligenceRecord, brandVisual: BrandVisualIntelligenceRecord, enhancementPlan: ImageEnhancementPlanningRecord | null, projectId?: string, campaign?: string, platform?: CreativeImagePlatform, layoutType?: CreativeLayoutType, creativeStyle?: CreativeStyleCategory, marketingType?: MarketingLayoutType): {
        profile: CreativeImageProfile;
        layoutPlanning: LayoutPlanning;
        creativeStylePlan: CreativeStylePlanning;
        marketingPreparation: MarketingPreparation;
        platformPreparation: PlatformPreparation;
        productionInstructions: CreativeProductionInstructions;
        recommendations: CreativeImageRecommendation[];
        keywords: string[];
    };
    private inferPlatform;
    private inferLayoutType;
    private mapBrandStyle;
    private buildCreativeStyle;
    private inferSecondaryStyle;
    private buildLayoutPlanning;
    private safeAreasForPlatform;
    private buildMarketingPreparation;
    private inferMarketingType;
    private buildPlatformPreparation;
    private buildProductionInstructions;
    private buildRecommendations;
}
//# sourceMappingURL=creative-image-analyzer.d.ts.map