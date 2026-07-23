import crypto from "node:crypto";
import { ImageAnalysisRecord, ImageLearningPattern } from "./types.js";
import { ImagePatternStore } from "./image-stores.js";
import { ImageKnowledgeLogger } from "./image-logger.js";

export class ImageLearner {
  constructor(
    private readonly patterns: ImagePatternStore,
    private readonly logger: ImageKnowledgeLogger
  ) {}

  learnFromAnalysis(record: ImageAnalysisRecord): ImageLearningPattern[] {
    const learned: ImageLearningPattern[] = [];

    if (record.scores.compositionScore >= 80) {
      const pattern = this.createPattern(
        record,
        "composition",
        `Effective ${record.design.layout} composition with ${record.visual.composition}`,
        record.scores.compositionScore
      );
      this.patterns.add(pattern);
      learned.push(pattern);
    }

    if (record.brand.brandConsistency >= 78) {
      const pattern = this.createPattern(
        record,
        "branding",
        `Strong brand consistency: ${record.brand.brandIdentity} with ${record.brand.logoPosition} logo`,
        record.brand.brandConsistency
      );
      this.patterns.add(pattern);
      learned.push(pattern);
    }

    if (record.scores.productVisibilityScore >= 85) {
      const pattern = this.createPattern(
        record,
        "product-presentation",
        `High visibility product at ${record.productPresentation.position} with ${record.productPresentation.angle} angle`,
        record.scores.productVisibilityScore
      );
      this.patterns.add(pattern);
      learned.push(pattern);
    }

    if (record.design.creativeStyle) {
      const pattern = this.createPattern(
        record,
        "style",
        `${record.design.creativeStyle} style with ${record.design.colorHarmony} color harmony`,
        record.scores.marketingReadinessScore
      );
      this.patterns.add(pattern);
      learned.push(pattern);
    }

    if (learned.length > 0) {
      this.logger.log("info", "learning", "Visual patterns learned", {
        imageId: record.imageId,
        patterns: learned.length,
      });
    }

    return learned;
  }

  private createPattern(
    record: ImageAnalysisRecord,
    patternType: ImageLearningPattern["patternType"],
    description: string,
    confidence: number
  ): ImageLearningPattern {
    return {
      patternId: `imgpat-${crypto.randomBytes(4).toString("hex")}`,
      patternType,
      description,
      sourceImageId: record.imageId,
      confidence: Math.min(100, confidence),
      detectedAt: new Date().toISOString(),
    };
  }
}
