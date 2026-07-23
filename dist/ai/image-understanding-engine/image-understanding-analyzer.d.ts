import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import { BrandUnderstanding, ImageContextUnderstanding, ImageIdentity, ImagePurpose, ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, MarketingUnderstanding, ProductInImageUnderstanding, SceneUnderstanding, UnderstandingRecommendation, VisualUnderstanding } from "./types.js";
export declare class ImageUnderstandingAnalyzer {
    buildFromAnalysis(analysis: ImageAnalysisIntelligenceRecord, marketingGoal?: ImageUnderstandingMarketingGoal, platform?: ImageUnderstandingPlatform, industry?: string): {
        identity: ImageIdentity;
        purpose: ImagePurpose;
        context: ImageContextUnderstanding;
        scene: SceneUnderstanding;
        visual: VisualUnderstanding;
        product: ProductInImageUnderstanding;
        brand: BrandUnderstanding;
        marketing: MarketingUnderstanding;
        recommendations: UnderstandingRecommendation[];
        keywords: string[];
    };
    private inferPrimaryPurpose;
    private buildSceneUnderstanding;
    private buildVisualUnderstanding;
    private buildProductUnderstanding;
    private buildBrandUnderstanding;
    private buildMarketingUnderstanding;
    private buildRecommendations;
    private technicalFallback;
}
//# sourceMappingURL=image-understanding-analyzer.d.ts.map