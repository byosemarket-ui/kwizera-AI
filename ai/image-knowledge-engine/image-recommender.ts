import {
  CreativeStyle,
  ImageAnalysisRecord,
  ImageRelationships,
  VisualRecommendation,
} from "./types.js";

export class ImageRecommender {
  recommend(record: ImageAnalysisRecord): VisualRecommendation[] {
    const recs: VisualRecommendation[] = [];

    if (record.metrics.brightness < 65) {
      recs.push({
        category: "lighting",
        suggestion: "Increase brightness with soft fill lighting for better product visibility",
        priority: "high",
        reason: `Brightness score ${record.metrics.brightness} is below optimal`,
      });
    }

    if (record.metrics.compositionQuality < 70) {
      recs.push({
        category: "composition",
        suggestion: "Apply rule-of-thirds alignment and increase negative space around product",
        priority: "high",
        reason: `Composition quality ${record.metrics.compositionQuality} needs improvement`,
      });
    }

    if (record.brand.brandConsistency < 75) {
      recs.push({
        category: "branding",
        suggestion: "Align logo position and brand colors with brand identity guidelines",
        priority: "medium",
        reason: `Brand consistency ${record.brand.brandConsistency} below target`,
      });
    }

    if (record.productPresentation.visibility < 80) {
      recs.push({
        category: "product-position",
        suggestion: "Center product hero and increase size ratio for stronger focus",
        priority: "high",
        reason: `Product visibility ${record.productPresentation.visibility} is low`,
      });
    }

    if (record.metrics.saturation < 60 || record.metrics.colorBalance < 70) {
      recs.push({
        category: "color-palette",
        suggestion: "Use complementary brand palette with balanced saturation",
        priority: "medium",
        reason: "Color balance or saturation below marketing-ready threshold",
      });
    }

    if (record.visual.background === "busy" || record.visual.background.includes("cluttered")) {
      recs.push({
        category: "background",
        suggestion: "Switch to clean studio gradient or minimal lifestyle background",
        priority: "high",
        reason: "Background competes with product focus",
      });
    }

    if (record.design.typography === "none" || record.visual.textInImage.length === 0) {
      recs.push({
        category: "typography",
        suggestion: "Add minimal sans-serif headline aligned with brand typography",
        priority: "low",
        reason: "Marketing images benefit from clear typographic hierarchy",
      });
    }

    if (record.design.creativeStyle === CreativeStyle.Minimal && record.design.visualBalance < 75) {
      recs.push({
        category: "design",
        suggestion: "Increase whitespace and simplify icon placement for minimal style",
        priority: "medium",
        reason: "Minimal style requires stronger visual balance",
      });
    }

    return recs.sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  }
}

export class ImageRelationshipLinker {
  detectSimilar(
    record: ImageAnalysisRecord,
    allRecords: ImageAnalysisRecord[]
  ): ImageRelationships {
    const relationships: ImageRelationships = {
      similarImages: [],
      similarProducts: [],
      similarBrands: [],
      similarStyles: [],
      similarLayouts: [],
      similarCampaigns: [],
    };

    for (const other of allRecords) {
      if (other.imageId === record.imageId) continue;

      const sameBrand =
        record.productPresentation.branding === other.productPresentation.branding &&
        record.productPresentation.branding !== "unknown";
      const score = this.similarityScore(record, other);

      if (score < 40 && !sameBrand) continue;

      relationships.similarImages.push(other.imageId);

      if (sameBrand) {
        relationships.similarBrands.push(other.imageId);
      }
      if (record.visual.products.some((p) => other.visual.products.includes(p))) {
        relationships.similarProducts.push(other.imageId);
      }
      if (record.design.creativeStyle === other.design.creativeStyle) {
        relationships.similarStyles.push(other.imageId);
      }
      if (record.design.layout === other.design.layout) {
        relationships.similarLayouts.push(other.imageId);
      }
      if (record.tags.some((t) => other.tags.includes(t) && t.includes("campaign"))) {
        relationships.similarCampaigns.push(other.imageId);
      }
    }

    return relationships;
  }

  private similarityScore(a: ImageAnalysisRecord, b: ImageAnalysisRecord): number {
    let score = 0;
    if (a.design.creativeStyle === b.design.creativeStyle) score += 25;
    if (a.design.layout === b.design.layout) score += 20;
    if (a.productPresentation.branding === b.productPresentation.branding && a.productPresentation.branding !== "unknown") {
      score += 35;
    }
    const sharedColors = a.visual.dominantColors.filter((c) => b.visual.dominantColors.includes(c));
    score += sharedColors.length * 10;
    const sharedTags = a.tags.filter((t) => b.tags.includes(t));
    score += sharedTags.length * 8;
    return score;
  }
}
