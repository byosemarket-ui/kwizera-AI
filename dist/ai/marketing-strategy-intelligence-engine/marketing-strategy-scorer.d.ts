import { AudienceAlignment, BusinessGoalsAnalysis, CampaignStrategicDirection, CreativeStrategicPreparation, MarketingObjective, StrategyRecommendation, StrategyScores } from "./types.js";
export declare class MarketingStrategyScorer {
    computeScores(businessGoals: BusinessGoalsAnalysis, audienceAlignment: AudienceAlignment, strategies: StrategyRecommendation[], creativePreparation: CreativeStrategicPreparation, campaignDirection: CampaignStrategicDirection, objective: MarketingObjective): StrategyScores;
    isStrategyValid(scores: StrategyScores, strategies: StrategyRecommendation[], audienceAlignment: AudienceAlignment): {
        valid: boolean;
        diagnostics: string[];
    };
    private computeStrategyQuality;
    private computeBusinessAlignment;
    private computeMarketingReadiness;
}
//# sourceMappingURL=marketing-strategy-scorer.d.ts.map