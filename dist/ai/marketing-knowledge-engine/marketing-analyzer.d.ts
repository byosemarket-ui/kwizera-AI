import { BrandStrategyKnowledge, CampaignKnowledge, ContentKnowledge, CustomerJourneyKnowledge, CustomerPsychologyKnowledge, KnowledgeCampaignType, KnowledgeMarketingGoal, KnowledgeMarketingPlatform, MarketingAnalysisInput, MarketingStructureKnowledge, PlatformKnowledge, ProductPositioningKnowledge, StorytellingKnowledge } from "./types.js";
export declare class MarketingAnalyzer {
    analyze(input: MarketingAnalysisInput): {
        campaignType: KnowledgeCampaignType;
        marketingGoal: KnowledgeMarketingGoal;
        brand: BrandStrategyKnowledge;
        positioning: ProductPositioningKnowledge;
        customerJourney: CustomerJourneyKnowledge;
        customer: CustomerPsychologyKnowledge;
        structure: MarketingStructureKnowledge;
        campaign: CampaignKnowledge;
        content: ContentKnowledge;
        platformKnowledge: PlatformKnowledge;
        storytelling: StorytellingKnowledge;
        platform: KnowledgeMarketingPlatform;
        audience: string;
    };
    private defaultContentFormat;
    private defaultOptimalLength;
    private defaultBestPractices;
}
//# sourceMappingURL=marketing-analyzer.d.ts.map