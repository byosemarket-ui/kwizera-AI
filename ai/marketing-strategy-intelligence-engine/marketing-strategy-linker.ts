import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  BusinessGoalsAnalysis,
  MarketingStrategyRecord,
  MarketingStrategyRelationships,
  StrategyType,
} from "./types.js";

const STRATEGY_CREATIVE_STYLE: Partial<Record<StrategyType, string[]>> = {
  [StrategyType.Luxury]: ["premium-visual", "minimal-elegance"],
  [StrategyType.Lifestyle]: ["lifestyle", "aspirational"],
  [StrategyType.Demonstration]: ["product-demo", "how-to"],
  [StrategyType.Storytelling]: ["narrative", "brand-story"],
  [StrategyType.Emotional]: ["emotional", "human-centric"],
  [StrategyType.Promotional]: ["bold-cta", "offer-focused"],
  [StrategyType.Educational]: ["informative", "tutorial"],
  [StrategyType.SocialProof]: ["testimonial", "user-generated"],
  [StrategyType.ValueBased]: ["comparison", "benefit-highlight"],
  [StrategyType.ProblemSolution]: ["before-after", "pain-point"],
};

export class MarketingStrategyLinker {
  detectRelationships(
    record: MarketingStrategyRecord,
    allRecords: MarketingStrategyRecord[],
    understanding: ProductUnderstandingRecord,
    analysis: ProductAnalysisIntelligenceRecord,
    audienceIntelligence?: AudienceIntelligenceRecord,
    campaignId?: string
  ): MarketingStrategyRelationships {
    const products = [record.productId];
    const brands = [understanding.identity.brand];
    const audiences = [
      record.audienceId,
      understanding.customer.targetCustomer,
      ...understanding.customer.customerSegments,
    ];
    if (audienceIntelligence) {
      audiences.push(audienceIntelligence.profile.audienceName);
      audiences.push(...audienceIntelligence.relationships.customerSegments);
    }

    const campaigns: string[] = [];
    if (campaignId) campaigns.push(campaignId);
    if (record.relationships.campaigns.length > 0) {
      campaigns.push(...record.relationships.campaigns);
    }

    const creativeStyles: string[] = [
      ...understanding.relationships.creativeStyles,
      ...(audienceIntelligence?.relationships.creativeStyles ?? []),
    ];
    for (const strategy of record.selectedStrategies) {
      const styles = STRATEGY_CREATIVE_STYLE[strategy.strategyType] ?? [];
      creativeStyles.push(...styles);
    }

    const businessGoals = this.extractBusinessGoalLabels(record.businessGoals);

    const knowledgeRecords = [
      ...new Set([
        ...understanding.relationships.knowledgeRecords,
        ...(audienceIntelligence?.relationships.knowledgeRecords ?? []),
        ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
        ...analysis.relationships.relatedKnowledge,
      ]),
    ];

    for (const other of allRecords) {
      if (other.strategyId === record.strategyId) continue;
      if (other.productId !== record.productId) {
        if (other.audienceAlignment.targetAudience === record.audienceAlignment.targetAudience) {
          audiences.push(other.audienceAlignment.targetAudience);
        }
      }
      if (
        other.selectedStrategies.some((s) =>
          record.selectedStrategies.some((r) => r.strategyType === s.strategyType)
        )
      ) {
        creativeStyles.push("cross-campaign-aligned");
      }
    }

    return {
      products: [...new Set(products)],
      brands: [...new Set(brands)],
      audiences: [...new Set(audiences)].slice(0, 15),
      campaigns: [...new Set(campaigns)],
      creativeStyles: [...new Set(creativeStyles)].slice(0, 12),
      businessGoals: [...new Set(businessGoals)],
      knowledgeRecords,
    };
  }

  private extractBusinessGoalLabels(goals: BusinessGoalsAnalysis): string[] {
    return [
      ...goals.salesObjectives.map((g) => `sales:${g.slice(0, 40)}`),
      ...goals.marketingObjectives.map((g) => `marketing:${g.slice(0, 40)}`),
      ...goals.brandObjectives.map((g) => `brand:${g.slice(0, 40)}`),
      ...goals.customerObjectives.map((g) => `customer:${g.slice(0, 40)}`),
      ...goals.growthObjectives.map((g) => `growth:${g.slice(0, 40)}`),
      ...goals.communicationObjectives.map((g) => `communication:${g.slice(0, 40)}`),
    ];
  }
}
