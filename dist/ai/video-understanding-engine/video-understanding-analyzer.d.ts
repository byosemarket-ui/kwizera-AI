import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { AudienceUnderstanding, BrandUnderstanding, MarketingUnderstanding, ProductUnderstanding, SceneRelationshipMap, StoryUnderstanding, VideoContextUnderstanding, VideoIdentity, VideoPurpose, VideoSceneUnderstanding, VideoStoryType, VideoStructureHierarchy, VideoUnderstandingMarketingGoal, VideoUnderstandingRecommendation } from "./types.js";
export declare class VideoUnderstandingAnalyzer {
    buildFromAnalysis(analysis: VideoAnalysisIntelligenceRecord, marketingGoal?: VideoUnderstandingMarketingGoal, storyType?: VideoStoryType, industry?: string): {
        identity: VideoIdentity;
        purpose: VideoPurpose;
        context: VideoContextUnderstanding;
        scenes: VideoSceneUnderstanding[];
        sceneRelationships: SceneRelationshipMap[];
        story: StoryUnderstanding;
        product: ProductUnderstanding;
        brand: BrandUnderstanding;
        audience: AudienceUnderstanding;
        marketing: MarketingUnderstanding;
        structure: VideoStructureHierarchy;
        recommendations: VideoUnderstandingRecommendation[];
        keywords: string[];
        resolvedStoryType: VideoStoryType;
    };
    private inferPrimaryPurpose;
    private buildSceneUnderstanding;
    private assignSceneRole;
    private describeScene;
    private buildSceneRelationships;
    private buildStoryUnderstanding;
    private inferNarrativeStructure;
    private buildProductUnderstanding;
    private buildBrandUnderstanding;
    private buildAudienceUnderstanding;
    private inferAudience;
    private buildMarketingUnderstanding;
    private buildStructure;
    private buildRecommendations;
}
//# sourceMappingURL=video-understanding-analyzer.d.ts.map