import {
  KnowledgeCampaignType,
  MarketingAnalysisRecord,
  MarketingRecommendation,
  MarketingRelationships,
} from "./types.js";

export class MarketingRecommender {
  recommend(record: MarketingAnalysisRecord): MarketingRecommendation[] {
    const recs: MarketingRecommendation[] = [];

    if (record.storytelling.hookTiming > 5) {
      recs.push({
        category: "hooks",
        suggestion: "Move hook to first 3 seconds for stronger attention capture",
        priority: "high",
        reason: `Hook timing ${record.storytelling.hookTiming}s exceeds optimal window`,
      });
    }

    if (!record.structure.hook || record.structure.hook.length < 10) {
      recs.push({
        category: "headlines",
        suggestion: "Craft a stronger headline with clear benefit and urgency",
        priority: "high",
        reason: "Hook/headline too weak for campaign impact",
      });
    }

    if (!record.structure.callToAction || record.structure.callToAction.length < 5) {
      recs.push({
        category: "cta",
        suggestion: "Add action-oriented CTA with clear next step",
        priority: "high",
        reason: "Missing or weak call-to-action",
      });
    }

    if (record.positioning.uniqueSellingPoints.length < 2) {
      recs.push({
        category: "positioning",
        suggestion: "Define at least 3 unique selling points for clearer differentiation",
        priority: "medium",
        reason: "Insufficient product positioning depth",
      });
    }

    if (record.scores.storytellingScore < 75) {
      recs.push({
        category: "storytelling",
        suggestion: "Restructure narrative: problem → agitation → solution → proof → CTA",
        priority: "medium",
        reason: `Storytelling score ${record.scores.storytellingScore} below target`,
      });
    }

    if (record.scores.campaignStructureScore < 75) {
      recs.push({
        category: "campaign-structure",
        suggestion: "Add social proof and offer sections before final CTA",
        priority: "medium",
        reason: `Campaign structure score ${record.scores.campaignStructureScore}`,
      });
    }

    if (record.brand.brandConsistency < 78) {
      recs.push({
        category: "branding",
        suggestion: "Align voice, colors and messaging across all campaign touchpoints",
        priority: "medium",
        reason: `Brand consistency ${record.brand.brandConsistency} below target`,
      });
    }

    if (record.customer.customerNeeds.length < 2) {
      recs.push({
        category: "targeting",
        suggestion: "Deepen audience research — map needs, triggers and decision factors",
        priority: "high",
        reason: "Insufficient customer understanding for targeting",
      });
    }

    if (record.content.headlines.length < 2) {
      recs.push({
        category: "headlines",
        suggestion: "Create A/B headline variants for platform-specific testing",
        priority: "low",
        reason: "Limited headline variety for optimization",
      });
    }

    return recs.sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 };
      return p[b.priority] - p[a.priority];
    });
  }
}

export class MarketingRelationshipLinker {
  detectSimilar(
    record: MarketingAnalysisRecord,
    allRecords: MarketingAnalysisRecord[]
  ): MarketingRelationships {
    const relationships: MarketingRelationships = {
      relatedProducts: [],
      relatedBrands: [],
      relatedVideos: [],
      relatedCampaigns: [],
      relatedCustomers: [],
      relatedCreativeStyles: [],
      relatedBusinessGoals: [],
    };

    for (const other of allRecords) {
      if (other.campaignId === record.campaignId) continue;

      const sameBrand =
        record.brandName === other.brandName && record.brandName !== "unknown";
      const score = this.similarityScore(record, other);
      if (score < 35 && !sameBrand) continue;

      relationships.relatedCampaigns.push(other.campaignId);

      if (record.productName && record.productName === other.productName) {
        relationships.relatedProducts.push(other.campaignId);
      }
      if (sameBrand) {
        relationships.relatedBrands.push(other.campaignId);
      }
      if (record.campaign.marketingStyle === other.campaign.marketingStyle) {
        relationships.relatedCreativeStyles.push(other.campaignId);
      }
      if (record.marketingGoal === other.marketingGoal) {
        relationships.relatedBusinessGoals.push(other.campaignId);
      }
      if (record.audience === other.audience) {
        relationships.relatedCustomers.push(other.campaignId);
      }
      if (record.campaignType === KnowledgeCampaignType.VideoMarketing ||
          other.campaignType === KnowledgeCampaignType.VideoMarketing) {
        relationships.relatedVideos.push(other.campaignId);
      }
      const sharedTags = record.tags.filter((t) => other.tags.includes(t));
      if (sharedTags.some((t) => t.includes("video"))) {
        relationships.relatedVideos.push(other.campaignId);
      }
    }

    return relationships;
  }

  private similarityScore(a: MarketingAnalysisRecord, b: MarketingAnalysisRecord): number {
    let score = 0;
    if (a.brandName === b.brandName && a.brandName !== "unknown") score += 35;
    if (a.productName === b.productName && a.productName) score += 25;
    if (a.marketingGoal === b.marketingGoal) score += 15;
    if (a.campaign.marketingStyle === b.campaign.marketingStyle) score += 15;
    if (a.platform === b.platform) score += 10;
    const sharedTags = a.tags.filter((t) => b.tags.includes(t));
    score += sharedTags.length * 8;
    return score;
  }
}
