import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudienceAlignment, BusinessGoalsAnalysis, CampaignStrategicDirection, CreativeStrategicPreparation, MarketingObjective, StrategyMarketingPlatform, MarketingStrategyInput, StrategyRecommendation } from "./types.js";
export declare class MarketingStrategyAnalyzer {
    analyzeBusinessGoals(input: MarketingStrategyInput, understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord): BusinessGoalsAnalysis;
    buildAudienceAlignment(understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord, audienceIntelligence?: AudienceIntelligenceRecord, preferredPlatforms?: StrategyMarketingPlatform[]): AudienceAlignment;
    buildAudienceAlignmentFromIntelligence(audience: AudienceIntelligenceRecord, preferredPlatforms?: StrategyMarketingPlatform[]): AudienceAlignment;
    prepareCampaignDirection(objective: MarketingObjective, strategies: StrategyRecommendation[], audience: AudienceAlignment, understanding: ProductUnderstandingRecord, campaignId?: string): CampaignStrategicDirection;
    selectStrategies(objective: MarketingObjective, understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord): StrategyRecommendation[];
    prepareCreativeDirection(strategies: StrategyRecommendation[], understanding: ProductUnderstandingRecord, audience: AudienceAlignment): CreativeStrategicPreparation;
    private buildSalesObjectives;
    private buildMarketingObjectives;
    private buildBrandObjectives;
    private buildCustomerObjectives;
    private buildGrowthObjectives;
    private buildCommunicationObjectives;
    private inferCommunicationStyle;
    private buildRationale;
    private buildExpectedOutcome;
}
//# sourceMappingURL=marketing-strategy-analyzer.d.ts.map