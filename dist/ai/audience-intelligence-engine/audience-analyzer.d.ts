import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { ProductUnderstandingMarketingGoal } from "../product-understanding-engine/types.js";
import { AudienceDemographics, AudienceIntelligenceInput, AudienceMarketingPreparation, AudienceProfile, AudienceSegmentation, PsychologicalUnderstanding } from "./types.js";
export declare class AudienceAnalyzer {
    buildProfile(input: AudienceIntelligenceInput, understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord): AudienceProfile;
    buildDemographics(input: AudienceIntelligenceInput, analysis: ProductAnalysisIntelligenceRecord): AudienceDemographics;
    buildPsychologicalUnderstanding(understanding: ProductUnderstandingRecord, marketingGoal: ProductUnderstandingMarketingGoal): PsychologicalUnderstanding;
    buildSegmentation(understanding: ProductUnderstandingRecord, analysis: ProductAnalysisIntelligenceRecord, psychological: PsychologicalUnderstanding, profile: AudienceProfile): AudienceSegmentation;
    buildMarketingPreparation(profile: AudienceProfile, psychological: PsychologicalUnderstanding, segmentation: AudienceSegmentation): AudienceMarketingPreparation;
    private inferCommunicationStyle;
    private deriveCustomerGoals;
    private deriveCustomerInterests;
    private deriveDecisionFactors;
}
//# sourceMappingURL=audience-analyzer.d.ts.map