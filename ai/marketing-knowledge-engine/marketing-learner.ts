import crypto from "node:crypto";
import { MarketingAnalysisRecord, MarketingLearningPattern } from "./types.js";
import { MarketingPatternStore } from "./marketing-stores.js";
import { MarketingKnowledgeLogger } from "./marketing-logger.js";

export class MarketingLearner {
  constructor(
    private readonly patterns: MarketingPatternStore,
    private readonly logger: MarketingKnowledgeLogger
  ) {}

  learnFromAnalysis(record: MarketingAnalysisRecord): MarketingLearningPattern[] {
    const learned: MarketingLearningPattern[] = [];

    if (record.scores.brandConsistencyScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "brand-strategy",
          `Brand voice: ${record.brand.brandVoice}, consistency ${record.brand.brandConsistency}`,
          record.scores.brandConsistencyScore
        )
      );
    }

    if (record.scores.marketingQualityScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "positioning",
          `Positioning: ${record.positioning.valueProposition} for ${record.positioning.targetSegment}`,
          record.scores.marketingQualityScore
        )
      );
    }

    if (record.scores.storytellingScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "storytelling",
          `Narrative: ${record.storytelling.narrativeArc}, hook at ${record.storytelling.hookTiming}s`,
          record.scores.storytellingScore
        )
      );
    }

    if (record.scores.campaignStructureScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "campaign",
          `Campaign flow: ${record.campaign.campaignFlow}, style ${record.campaign.marketingStyle}`,
          record.scores.campaignStructureScore
        )
      );
    }

    if (record.content.headlines.length >= 2) {
      learned.push(
        this.createPattern(
          record,
          "content",
          `Content: ${record.content.copywritingStyle}, ${record.content.headlines.length} headlines`,
          record.scores.marketingQualityScore
        )
      );
    }

    if (record.scores.customerRelevanceScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "customer",
          `Customer intent: ${record.customer.customerIntent}, ${record.customer.buyingTriggers.length} triggers`,
          record.scores.customerRelevanceScore
        )
      );
    }

    if (record.scores.conversionReadinessScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "conversion",
          `CTA: ${record.structure.callToAction}, conversion readiness ${record.scores.conversionReadinessScore}`,
          record.scores.conversionReadinessScore
        )
      );
    }

    for (const pattern of learned) {
      this.patterns.add(pattern);
    }

    if (learned.length > 0) {
      this.logger.log("info", "learning", "Marketing patterns learned", {
        campaignId: record.campaignId,
        patterns: learned.length,
      });
    }

    return learned;
  }

  private createPattern(
    record: MarketingAnalysisRecord,
    patternType: MarketingLearningPattern["patternType"],
    description: string,
    confidence: number
  ): MarketingLearningPattern {
    return {
      patternId: `mkpat-${crypto.randomBytes(4).toString("hex")}`,
      patternType,
      description,
      sourceCampaignId: record.campaignId,
      confidence: Math.min(100, confidence),
      detectedAt: new Date().toISOString(),
    };
  }
}
