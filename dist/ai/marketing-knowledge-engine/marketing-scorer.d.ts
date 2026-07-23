import { BrandStrategyKnowledge, CampaignKnowledge, ContentKnowledge, CustomerPsychologyKnowledge, MarketingQualityScores, MarketingStructureKnowledge, StorytellingKnowledge } from "./types.js";
export declare class MarketingScorer {
    computeScores(brand: BrandStrategyKnowledge, structure: MarketingStructureKnowledge, campaign: CampaignKnowledge, customer: CustomerPsychologyKnowledge, content: ContentKnowledge, storytelling: StorytellingKnowledge): MarketingQualityScores;
    isAnalysisValid(scores: MarketingQualityScores): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=marketing-scorer.d.ts.map