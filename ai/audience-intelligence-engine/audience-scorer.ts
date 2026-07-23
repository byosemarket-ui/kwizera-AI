import {
  AudienceDemographics,
  AudienceMarketingPreparation,
  AudienceProfile,
  AudienceScores,
  PsychologicalUnderstanding,
} from "./types.js";

export class AudienceScorer {
  computeScores(
    profile: AudienceProfile,
    demographics: AudienceDemographics,
    psychological: PsychologicalUnderstanding,
    marketingPreparation: AudienceMarketingPreparation,
    relationshipCount: number
  ): AudienceScores {
    const audienceRelevanceScore = this.computeRelevance(profile, psychological);
    const audienceConfidenceScore = this.computeConfidence(demographics, psychological);
    const marketingReadinessScore = this.computeMarketingReadiness(marketingPreparation);
    const communicationReadinessScore = this.computeCommunicationReadiness(profile, psychological);
    const relationshipScore = Math.min(100, 40 + relationshipCount * 5);

    return {
      audienceRelevanceScore,
      audienceConfidenceScore,
      marketingReadinessScore,
      communicationReadinessScore,
      relationshipScore,
    };
  }

  isAudienceValid(
    scores: AudienceScores,
    profile: AudienceProfile,
    psychological: PsychologicalUnderstanding,
    demographics: AudienceDemographics
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (!profile.audienceName) {
      diagnostics.push("Audience name is required");
    }
    if (psychological.customerNeeds.length < 2) {
      diagnostics.push("Insufficient grounded customer needs (minimum 2)");
    }
    if (!psychological.buyingIntent) {
      diagnostics.push("Buying intent must be derived from marketing goal");
    }
    if (scores.audienceRelevanceScore < 55) {
      diagnostics.push(`Audience relevance score ${scores.audienceRelevanceScore} below threshold (55)`);
    }
    if (scores.audienceConfidenceScore < 50) {
      diagnostics.push(`Audience confidence score ${scores.audienceConfidenceScore} below threshold (50)`);
    }
    if (scores.communicationReadinessScore < 45) {
      diagnostics.push(
        `Communication readiness score ${scores.communicationReadinessScore} below threshold (45)`
      );
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  private computeRelevance(profile: AudienceProfile, psychological: PsychologicalUnderstanding): number {
    let score = 50;
    if (profile.audienceName.length >= 5) score += 10;
    if (psychological.customerNeeds.length >= 3) score += 15;
    if (psychological.customerChallenges.length >= 2) score += 10;
    if (psychological.customerMotivation.length >= 2) score += 10;
    if (psychological.decisionFactors.length >= 3) score += 5;
    return Math.min(100, score);
  }

  private computeConfidence(
    demographics: AudienceDemographics,
    psychological: PsychologicalUnderstanding
  ): number {
    let score = 45;
    if (demographics.businessType) score += 15;
    if (demographics.customerType) score += 15;
    if (psychological.customerGoals.length >= 1) score += 10;
    if (psychological.customerInterests.length >= 2) score += 10;
    if (demographics.language) score += 5;
    return Math.min(100, score);
  }

  private computeMarketingReadiness(prep: AudienceMarketingPreparation): number {
    const flags = [
      prep.marketingStrategyReady,
      prep.creativeDirectionReady,
      prep.storyboardReady,
      prep.scriptPlanningReady,
      prep.visualPlanningReady,
      prep.productionPlanningReady,
    ];
    return Math.round((flags.filter(Boolean).length / flags.length) * 100);
  }

  private computeCommunicationReadiness(
    profile: AudienceProfile,
    psychological: PsychologicalUnderstanding
  ): number {
    let score = 40;
    if (profile.preferredPlatforms.length >= 2) score += 20;
    if (profile.preferredCommunicationStyle) score += 15;
    if (psychological.buyingIntent) score += 10;
    if (profile.preferredLanguage) score += 5;
    if (profile.preferredPlatforms.length >= 3) score += 10;
    return Math.min(100, score);
  }
}
