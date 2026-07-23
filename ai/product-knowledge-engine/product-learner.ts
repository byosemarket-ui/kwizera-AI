import crypto from "node:crypto";
import { ProductAnalysisRecord, ProductKnowledgeLearningPattern } from "./types.js";
import { ProductPatternStore } from "./product-stores.js";
import { ProductKnowledgeLogger } from "./product-logger.js";

export class ProductLearner {
  constructor(
    private readonly patterns: ProductPatternStore,
    private readonly logger: ProductKnowledgeLogger
  ) {}

  learnFromAnalysis(record: ProductAnalysisRecord): ProductKnowledgeLearningPattern[] {
    const learned: ProductKnowledgeLearningPattern[] = [];

    if (record.scores.productQualityScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "profile",
          `${record.profile.category}/${record.profile.subcategory}: ${record.profile.productName}`,
          record.scores.productQualityScore
        )
      );
    }

    if (record.scores.presentationScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "visual",
          `Presentation: ${record.visual.productPlacement} on ${record.visual.productBackground}`,
          record.scores.presentationScore
        )
      );
    }

    if (record.scores.brandConsistencyScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "brand",
          `Brand: ${record.brand.brandStyle}, consistency ${record.brand.brandConsistency}`,
          record.scores.brandConsistencyScore
        )
      );
    }

    if (record.scores.marketingReadinessScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "marketing",
          `Positioning: ${record.marketing.productPositioning}, CTA: ${record.marketing.callToAction}`,
          record.scores.marketingReadinessScore
        )
      );
    }

    if (record.scores.customerRelevanceScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "customer",
          `Audience: ${record.profile.targetAudience}, motivation: ${record.customer.buyingMotivation}`,
          record.scores.customerRelevanceScore
        )
      );
    }

    if (record.visual.productVisibility >= 85) {
      learned.push(
        this.createPattern(
          record,
          "presentation",
          `High visibility (${record.visual.productVisibility}) with ${record.visual.productShape}`,
          record.visual.productVisibility
        )
      );
    }

    if (record.marketing.uniqueSellingPoints.length >= 3) {
      learned.push(
        this.createPattern(
          record,
          "positioning",
          `USPs: ${record.marketing.uniqueSellingPoints.slice(0, 3).join(", ")}`,
          record.scores.marketingReadinessScore
        )
      );
    }

    for (const pattern of learned) {
      this.patterns.add(pattern);
    }

    if (learned.length > 0) {
      this.logger.log("info", "learning", "Product patterns learned", {
        productId: record.productId,
        patterns: learned.length,
      });
    }

    return learned;
  }

  private createPattern(
    record: ProductAnalysisRecord,
    patternType: ProductKnowledgeLearningPattern["patternType"],
    description: string,
    confidence: number
  ): ProductKnowledgeLearningPattern {
    return {
      patternId: `pkpat-${crypto.randomBytes(4).toString("hex")}`,
      patternType,
      description,
      sourceProductId: record.productId,
      confidence: Math.min(100, confidence),
      detectedAt: new Date().toISOString(),
    };
  }
}
