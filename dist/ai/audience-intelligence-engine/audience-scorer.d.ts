import { AudienceDemographics, AudienceMarketingPreparation, AudienceProfile, AudienceScores, PsychologicalUnderstanding } from "./types.js";
export declare class AudienceScorer {
    computeScores(profile: AudienceProfile, demographics: AudienceDemographics, psychological: PsychologicalUnderstanding, marketingPreparation: AudienceMarketingPreparation, relationshipCount: number): AudienceScores;
    isAudienceValid(scores: AudienceScores, profile: AudienceProfile, psychological: PsychologicalUnderstanding, demographics: AudienceDemographics): {
        valid: boolean;
        diagnostics: string[];
    };
    private computeRelevance;
    private computeConfidence;
    private computeMarketingReadiness;
    private computeCommunicationReadiness;
}
//# sourceMappingURL=audience-scorer.d.ts.map