import {
  BrandAnalysisRecord,
  BrandKnowledgeRecommendation,
  BrandKnowledgeRelationships,
} from "./types.js";

export class BrandRecommender {
  recommend(record: BrandAnalysisRecord): BrandKnowledgeRecommendation[] {
    const recs: BrandKnowledgeRecommendation[] = [];

    for (const issue of record.consistency.inconsistencies) {
      if (issue.includes("color")) {
        recs.push({
          category: "color-usage",
          suggestion: "Expand brand palette to at least 3 primary colors with usage guidelines",
          priority: "high",
          reason: issue,
        });
      }
      if (issue.includes("voice") || issue.includes("tone")) {
        recs.push({
          category: "consistency",
          suggestion: "Align brand voice and marketing tone across all communication channels",
          priority: "high",
          reason: issue,
        });
      }
      if (issue.includes("Logo")) {
        recs.push({
          category: "logo-placement",
          suggestion: "Document logo clear space, minimum size and approved variations",
          priority: "high",
          reason: issue,
        });
      }
    }

    if (record.consistency.logoUsage < 80) {
      recs.push({
        category: "logo-placement",
        suggestion: "Define logo placement rules for images, videos and marketing materials",
        priority: "medium",
        reason: `Logo usage score ${record.consistency.logoUsage}`,
      });
    }

    if (record.consistency.colorUsage < 80) {
      recs.push({
        category: "color-usage",
        suggestion: "Create color hierarchy: primary, secondary, accent with contrast ratios",
        priority: "medium",
        reason: `Color usage score ${record.consistency.colorUsage}`,
      });
    }

    if (record.consistency.typography < 80) {
      recs.push({
        category: "typography",
        suggestion: "Specify heading, body and accent typefaces with size and weight rules",
        priority: "medium",
        reason: `Typography score ${record.consistency.typography}`,
      });
    }

    if (record.scores.communicationScore < 78) {
      recs.push({
        category: "storytelling",
        suggestion: "Develop brand storytelling framework aligned with mission and values",
        priority: "medium",
        reason: `Communication score ${record.scores.communicationScore}`,
      });
    }

    if (record.consistency.marketingConsistency < 80) {
      recs.push({
        category: "marketing-alignment",
        suggestion: "Sync marketing tone with brand personality and target audience",
        priority: "medium",
        reason: `Marketing consistency ${record.consistency.marketingConsistency}`,
      });
    }

    if (record.consistency.overallConsistency < 85) {
      recs.push({
        category: "branding",
        suggestion: "Conduct full brand audit across visual, voice and motion touchpoints",
        priority: "high",
        reason: `Overall consistency ${record.consistency.overallConsistency}`,
      });
    }

    if (record.visual.logoVariations.length < 2) {
      recs.push({
        category: "branding",
        suggestion: "Create horizontal, icon and monochrome logo variations",
        priority: "low",
        reason: "Limited logo variation set",
      });
    }

    return recs.sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 };
      return p[b.priority] - p[a.priority];
    });
  }
}

export class BrandRelationshipLinker {
  detectSimilar(
    record: BrandAnalysisRecord,
    allRecords: BrandAnalysisRecord[]
  ): BrandKnowledgeRelationships {
    const relationships: BrandKnowledgeRelationships = {
      relatedProducts: [],
      relatedCampaigns: [],
      relatedVideos: [],
      relatedImages: [],
      relatedMarketingStrategies: [],
      relatedCreativeStyles: [],
      relatedCustomerSegments: [],
      relatedProjects: [],
    };

    for (const other of allRecords) {
      if (other.brandId === record.brandId) continue;

      const sameName =
        record.profile.brandName.toLowerCase() === other.profile.brandName.toLowerCase();
      const score = this.similarityScore(record, other);
      if (score < 35 && !sameName) continue;

      if (record.profile.industry === other.profile.industry) {
        relationships.relatedCreativeStyles.push(other.brandId);
      }
      if (record.marketingStyle === other.marketingStyle) {
        relationships.relatedMarketingStrategies.push(other.brandId);
      }
      if (record.profile.brandTargetAudience === other.profile.brandTargetAudience) {
        relationships.relatedCustomerSegments.push(other.brandId);
      }

      const sharedTags = record.tags.filter((t) => other.tags.includes(t));
      if (sharedTags.some((t) => t.includes("product"))) {
        relationships.relatedProducts.push(other.brandId);
      }
      if (sharedTags.some((t) => t.includes("campaign"))) {
        relationships.relatedCampaigns.push(other.brandId);
      }
      if (sharedTags.some((t) => t.includes("video"))) {
        relationships.relatedVideos.push(other.brandId);
      }
      if (sharedTags.some((t) => t.includes("image"))) {
        relationships.relatedImages.push(other.brandId);
      }
      if (sharedTags.some((t) => t.includes("project"))) {
        relationships.relatedProjects.push(other.brandId);
      }
    }

    return relationships;
  }

  private similarityScore(a: BrandAnalysisRecord, b: BrandAnalysisRecord): number {
    let score = 0;
    if (a.profile.brandName.toLowerCase() === b.profile.brandName.toLowerCase()) score += 40;
    if (a.profile.industry === b.profile.industry) score += 25;
    if (a.marketingStyle === b.marketingStyle) score += 15;
    if (a.profile.brandTargetAudience === b.profile.brandTargetAudience) score += 10;
    const sharedColors = a.visual.brandColors.filter((c) => b.visual.brandColors.includes(c));
    score += sharedColors.length * 8;
    const sharedTags = a.tags.filter((t) => b.tags.includes(t));
    score += sharedTags.length * 6;
    return score;
  }
}
