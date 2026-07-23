import crypto from "node:crypto";
import { BrandAnalysisRecord, BrandKnowledgeLearningPattern } from "./types.js";
import { BrandPatternStore } from "./brand-stores.js";
import { BrandKnowledgeLogger } from "./brand-logger.js";

export class BrandLearner {
  constructor(
    private readonly patterns: BrandPatternStore,
    private readonly logger: BrandKnowledgeLogger
  ) {}

  learnFromAnalysis(record: BrandAnalysisRecord): BrandKnowledgeLearningPattern[] {
    const learned: BrandKnowledgeLearningPattern[] = [];

    if (record.scores.brandConsistencyScore >= 80) {
      learned.push(
        this.createPattern(
          record,
          "consistency",
          `Consistent brand: ${record.consistency.overallConsistency}% across touchpoints`,
          record.scores.brandConsistencyScore
        )
      );
    }

    if (record.scores.visualIdentityScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "visual",
          `Visual: ${record.visual.designLanguage}, colors ${record.visual.brandColors.length}`,
          record.scores.visualIdentityScore
        )
      );
    }

    if (record.scores.communicationScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "communication",
          `Voice: ${record.communication.brandVoice}, style ${record.communication.writingStyle}`,
          record.scores.communicationScore
        )
      );
    }

    if (record.scores.recognitionScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "identity",
          `Identity: ${record.profile.brandName} — ${record.profile.brandPositioning}`,
          record.scores.recognitionScore
        )
      );
    }

    if (record.scores.marketingScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "campaign",
          `Marketing: ${record.communication.marketingTone}, CTA ${record.communication.callToActionStyle}`,
          record.scores.marketingScore
        )
      );
    }

    if (record.consistency.overallConsistency >= 85) {
      learned.push(
        this.createPattern(
          record,
          "presentation",
          `Presentation: ${record.visual.introStyle} → ${record.visual.outroStyle}`,
          record.consistency.overallConsistency
        )
      );
    }

    for (const pattern of learned) {
      this.patterns.add(pattern);
    }

    if (learned.length > 0) {
      this.logger.log("info", "learning", "Brand patterns learned", {
        brandId: record.brandId,
        patterns: learned.length,
      });
    }

    return learned;
  }

  private createPattern(
    record: BrandAnalysisRecord,
    patternType: BrandKnowledgeLearningPattern["patternType"],
    description: string,
    confidence: number
  ): BrandKnowledgeLearningPattern {
    return {
      patternId: `bkpat-${crypto.randomBytes(4).toString("hex")}`,
      patternType,
      description,
      sourceBrandId: record.brandId,
      confidence: Math.min(100, confidence),
      detectedAt: new Date().toISOString(),
    };
  }
}
