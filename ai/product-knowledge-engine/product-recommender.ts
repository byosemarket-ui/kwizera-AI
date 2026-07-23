import {
  ProductAnalysisRecord,
  ProductKnowledgeRecommendation,
  ProductKnowledgeRelationships,
} from "./types.js";

export class ProductRecommender {
  recommend(record: ProductAnalysisRecord): ProductKnowledgeRecommendation[] {
    const recs: ProductKnowledgeRecommendation[] = [];

    if (record.visual.productVisibility < 80) {
      recs.push({
        category: "presentation",
        suggestion: "Increase product visibility with hero placement and tighter crop",
        priority: "high",
        reason: `Product visibility ${record.visual.productVisibility} below target`,
      });
    }

    if (record.visual.productBackground === "busy" || record.visual.productBackground.includes("cluttered")) {
      recs.push({
        category: "background",
        suggestion: "Use clean studio gradient or lifestyle context background",
        priority: "high",
        reason: "Background may reduce product focus",
      });
    }

    if (record.visual.productPlacement !== "center-hero") {
      recs.push({
        category: "positioning",
        suggestion: "Center product as hero element with rule-of-thirds alignment",
        priority: "medium",
        reason: `Current placement: ${record.visual.productPlacement}`,
      });
    }

    if (record.marketing.uniqueSellingPoints.length < 3) {
      recs.push({
        category: "marketing",
        suggestion: "Define at least 3 unique selling points for stronger positioning",
        priority: "medium",
        reason: "Insufficient USP depth for marketing campaigns",
      });
    }

    if (!record.marketing.callToAction || record.marketing.callToAction.length < 8) {
      recs.push({
        category: "cta",
        suggestion: "Add action-oriented CTA with urgency and clear benefit",
        priority: "high",
        reason: "Weak or missing call-to-action",
      });
    }

    if (record.brand.brandConsistency < 78) {
      recs.push({
        category: "branding",
        suggestion: "Align logo usage, colors and brand voice across all product assets",
        priority: "medium",
        reason: `Brand consistency ${record.brand.brandConsistency} below target`,
      });
    }

    if (record.scores.presentationScore < 75) {
      recs.push({
        category: "creative-direction",
        suggestion: "Improve lighting, texture detail and packaging presentation",
        priority: "medium",
        reason: `Presentation score ${record.scores.presentationScore}`,
      });
    }

    if (record.scores.marketingReadinessScore < 75) {
      recs.push({
        category: "video-structure",
        suggestion: "Structure promo video: hook → product hero → benefits → social proof → CTA",
        priority: "medium",
        reason: `Marketing readiness ${record.scores.marketingReadinessScore}`,
      });
    }

    if (record.customer.customerNeeds.length < 2) {
      recs.push({
        category: "marketing",
        suggestion: "Map customer needs and problems to product benefits in messaging",
        priority: "high",
        reason: "Insufficient customer understanding for targeting",
      });
    }

    return recs.sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 };
      return p[b.priority] - p[a.priority];
    });
  }
}

export class ProductRelationshipLinker {
  detectSimilar(
    record: ProductAnalysisRecord,
    allRecords: ProductAnalysisRecord[]
  ): ProductKnowledgeRelationships {
    const relationships: ProductKnowledgeRelationships = {
      relatedProducts: [],
      relatedBrands: [],
      relatedVideos: [],
      relatedImages: [],
      relatedMarketingCampaigns: [],
      relatedProjects: [],
      relatedCreativeStyles: [],
      relatedCustomerSegments: [],
    };

    for (const other of allRecords) {
      if (other.productId === record.productId) continue;

      const sameBrand =
        record.profile.brand === other.profile.brand && record.profile.brand !== "Unknown Brand";
      const score = this.similarityScore(record, other);
      if (score < 35 && !sameBrand) continue;

      relationships.relatedProducts.push(other.productId);

      if (sameBrand) {
        relationships.relatedBrands.push(other.productId);
      }
      if (record.profile.category === other.profile.category) {
        relationships.relatedCreativeStyles.push(other.productId);
      }
      if (record.profile.targetAudience === other.profile.targetAudience) {
        relationships.relatedCustomerSegments.push(other.productId);
      }
      if (record.profile.marketingGoal === other.profile.marketingGoal) {
        relationships.relatedMarketingCampaigns.push(other.productId);
      }
      const sharedTags = record.tags.filter((t) => other.tags.includes(t));
      if (sharedTags.some((t) => t.includes("video"))) {
        relationships.relatedVideos.push(other.productId);
      }
      if (sharedTags.some((t) => t.includes("image"))) {
        relationships.relatedImages.push(other.productId);
      }
      if (sharedTags.some((t) => t.includes("project"))) {
        relationships.relatedProjects.push(other.productId);
      }
    }

    return relationships;
  }

  private similarityScore(a: ProductAnalysisRecord, b: ProductAnalysisRecord): number {
    let score = 0;
    if (a.profile.brand === b.profile.brand && a.profile.brand !== "Unknown Brand") score += 35;
    if (a.profile.category === b.profile.category) score += 25;
    if (a.profile.subcategory === b.profile.subcategory) score += 15;
    if (a.profile.marketingGoal === b.profile.marketingGoal) score += 10;
    if (a.profile.targetAudience === b.profile.targetAudience) score += 10;
    const sharedTags = a.tags.filter((t) => b.tags.includes(t));
    score += sharedTags.length * 8;
    return score;
  }
}
