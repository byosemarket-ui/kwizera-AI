import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { LearningCategory, LearningOutcome, LearningSource } from "../learning-memory-engine/types.js";
import { MarketingMemoryLogger } from "./marketing-logger.js";
import { MarketingLearningResult, MarketingRecord } from "./types.js";

export class MarketingLearner {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: MarketingMemoryLogger
  ) {}

  async learnFromCompletedCampaign(
    campaign: MarketingRecord,
    patternsStored: number
  ): Promise<MarketingLearningResult> {
    const strengths = this.identifyStrengths(campaign);
    const weaknesses = this.identifyWeaknesses(campaign);
    const recommendations = this.buildRecommendations(campaign, weaknesses);

    const learningEngine = this.foundation.getLearningMemoryEngine();
    const learnResult = await learningEngine.learnFromEvent({
      source: LearningSource.MarketingCampaign,
      category: LearningCategory.Marketing,
      title: `Campaign completed: ${campaign.campaignName}`,
      description: this.buildDescription(campaign, strengths, weaknesses),
      relatedProject: campaign.projectId,
      outcome: LearningOutcome.Success,
      qualityScore: campaign.scores.qualityScore,
      lessonLearned: campaign.lessonsLearned.join("; ") || undefined,
      patterns: campaign.patterns.map((p) => p.patternType),
      metadata: {
        campaignId: campaign.campaignId,
        platform: campaign.platform,
        effectiveness: campaign.scores.effectivenessScore,
      },
    });

    this.logger.log("info", "learning", "Marketing learning recorded", {
      campaignId: campaign.campaignId,
      learningId: learnResult.learningId,
    });

    return {
      success: learnResult.success,
      campaignId: campaign.campaignId,
      patternsStored,
      learningId: learnResult.learningId,
      recommendations,
      strengths,
      weaknesses,
    };
  }

  private identifyStrengths(campaign: MarketingRecord): string[] {
    const s: string[] = [];
    if (campaign.scores.qualityScore >= 70) s.push("High-quality campaign content");
    if (campaign.content.hooks.length > 0) s.push(`Strong hooks (${campaign.content.hooks.length})`);
    if (campaign.content.callToActions.length > 0) s.push("Clear call-to-action strategy");
    if (campaign.campaign.campaignStructure) s.push("Well-defined campaign structure");
    if (campaign.branding.brandVoice) s.push(`Consistent brand voice: ${campaign.branding.brandVoice}`);
    if (campaign.patterns.length > 0) s.push(`${campaign.patterns.length} reusable pattern(s)`);
    return s;
  }

  private identifyWeaknesses(campaign: MarketingRecord): string[] {
    const w: string[] = [];
    if (!campaign.content.hooks.length) w.push("Missing attention hooks");
    if (!campaign.content.callToActions.length) w.push("No call-to-action defined");
    if (!campaign.campaign.customerProblem) w.push("Customer problem not articulated");
    if (!campaign.branding.brandVoice) w.push("Brand voice undefined");
    if (campaign.scores.engagementScore < 50) w.push("Low engagement potential");
    return w;
  }

  private buildRecommendations(campaign: MarketingRecord, weaknesses: string[]): string[] {
    const recs: string[] = [];
    if (weaknesses.includes("Missing attention hooks")) {
      recs.push("Add a compelling hook in the first 3 seconds for " + campaign.platform);
    }
    if (weaknesses.includes("No call-to-action defined")) {
      recs.push("Include a clear, action-oriented CTA aligned with goal: " + campaign.goal);
    }
    if (campaign.patterns.length > 0) {
      recs.push(`Reuse ${campaign.patterns.length} proven pattern(s) in future campaigns`);
    }
    if (campaign.scores.conversionScore >= 70) {
      recs.push("Apply this CTA strategy to similar " + campaign.campaignType + " campaigns");
    }
    return recs;
  }

  private buildDescription(
    campaign: MarketingRecord,
    strengths: string[],
    weaknesses: string[]
  ): string {
    return [
      `Completed marketing campaign "${campaign.campaignName}" on ${campaign.platform}.`,
      `Brand: ${campaign.brand}, Goal: ${campaign.goal}.`,
      strengths.length ? `Strengths: ${strengths.join("; ")}.` : "",
      weaknesses.length ? `Improve: ${weaknesses.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
}
