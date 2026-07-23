import {
  AudienceAlignment,
  BusinessGoalsAnalysis,
  CampaignStrategicDirection,
  CreativeStrategicPreparation,
  MarketingObjective,
  StrategyRecommendation,
  StrategyScores,
} from "./types.js";

export class MarketingStrategyScorer {
  computeScores(
    businessGoals: BusinessGoalsAnalysis,
    audienceAlignment: AudienceAlignment,
    strategies: StrategyRecommendation[],
    creativePreparation: CreativeStrategicPreparation,
    campaignDirection: CampaignStrategicDirection,
    objective: MarketingObjective
  ): StrategyScores {
    const strategyQualityScore = this.computeStrategyQuality(strategies, objective);
    const audienceAlignmentScore = Math.min(100, audienceAlignment.alignmentScore);
    const businessAlignmentScore = this.computeBusinessAlignment(businessGoals, objective);
    const marketingReadinessScore = this.computeMarketingReadiness(creativePreparation, campaignDirection);
    const confidenceScore = Math.round(
      (strategyQualityScore + audienceAlignmentScore + businessAlignmentScore + marketingReadinessScore) / 4
    );

    return {
      strategyQualityScore,
      audienceAlignmentScore,
      businessAlignmentScore,
      marketingReadinessScore,
      confidenceScore,
    };
  }

  isStrategyValid(
    scores: StrategyScores,
    strategies: StrategyRecommendation[],
    audienceAlignment: AudienceAlignment
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    const hasPrimary = strategies.some((s) => s.priority === "primary");
    if (!hasPrimary) {
      diagnostics.push("No primary strategy selected — validation required");
    }
    if (strategies.length < 2) {
      diagnostics.push("Insufficient strategy recommendations (minimum 2)");
    }
    if (!audienceAlignment.targetAudience) {
      diagnostics.push("Target audience missing — cannot validate alignment");
    }
    if (scores.strategyQualityScore < 55) {
      diagnostics.push(`Strategy quality score ${scores.strategyQualityScore} below threshold (55)`);
    }
    if (scores.audienceAlignmentScore < 50) {
      diagnostics.push(`Audience alignment score ${scores.audienceAlignmentScore} below threshold (50)`);
    }
    if (scores.businessAlignmentScore < 50) {
      diagnostics.push(`Business alignment score ${scores.businessAlignmentScore} below threshold (50)`);
    }
    if (scores.confidenceScore < 55) {
      diagnostics.push(`Confidence score ${scores.confidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  private computeStrategyQuality(
    strategies: StrategyRecommendation[],
    objective: MarketingObjective
  ): number {
    let score = 50;
    if (strategies.some((s) => s.priority === "primary")) score += 15;
    if (strategies.length >= 3) score += 10;
    if (strategies.every((s) => s.rationale.length >= 30)) score += 10;
    if (strategies.every((s) => s.expectedOutcome.length >= 20)) score += 10;
    if (strategies.some((s) => s.rationale.includes(objective.replace(/-/g, " ")))) score += 5;
    return Math.min(100, score);
  }

  private computeBusinessAlignment(
    goals: BusinessGoalsAnalysis,
    objective: MarketingObjective
  ): number {
    const sections = [
      goals.salesObjectives,
      goals.marketingObjectives,
      goals.brandObjectives,
      goals.customerObjectives,
      goals.growthObjectives,
      goals.communicationObjectives,
    ];
    const filledSections = sections.filter((s) => s.length >= 1).length;
    let score = 40 + filledSections * 8;

    const objectiveKeyword = objective.replace(/-/g, " ");
    const allGoals = sections.flat().join(" ").toLowerCase();
    if (allGoals.includes(objectiveKeyword.split(" ")[0])) score += 10;

    return Math.min(100, score);
  }

  private computeMarketingReadiness(
    prep: CreativeStrategicPreparation,
    campaign: CampaignStrategicDirection
  ): number {
    const flags = [
      prep.storyboardReady,
      prep.scriptPlanningReady,
      prep.visualPlanningReady,
      prep.audioPlanningReady,
      prep.productionPlanningReady,
      campaign.campaignReady,
    ];
    const readyCount = flags.filter(Boolean).length;
    const directionQuality =
      [
        prep.storyboardDirection,
        prep.scriptPlanningDirection,
        prep.visualPlanningDirection,
        prep.audioPlanningDirection,
        prep.productionPlanningDirection,
      ].filter((d) => d.length >= 40).length;

    return Math.min(100, Math.round((readyCount / 6) * 60 + (directionQuality / 5) * 40));
  }
}
