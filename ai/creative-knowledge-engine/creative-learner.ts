import crypto from "node:crypto";
import { CreativeAnalysisRecord, CreativeKnowledgeLearningPattern } from "./types.js";
import { CreativePatternStore } from "./creative-stores.js";
import { CreativeKnowledgeLogger } from "./creative-logger.js";

export class CreativeLearner {
  constructor(
    private readonly patterns: CreativePatternStore,
    private readonly logger: CreativeKnowledgeLogger
  ) {}

  learnFromAnalysis(record: CreativeAnalysisRecord): CreativeKnowledgeLearningPattern[] {
    const learned: CreativeKnowledgeLearningPattern[] = [];

    if (record.scores.visualDesignScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "visual-design",
          `${record.domain}: ${record.visual.layout}, ${record.visual.composition}`,
          record.scores.visualDesignScore
        )
      );
    }

    if (record.scores.storytellingScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "storytelling",
          `Story: ${record.storytelling.storyStructure}, retention ${record.storytelling.attentionRetention}`,
          record.scores.storytellingScore
        )
      );
    }

    if (record.scores.animationScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "animation",
          `Motion: ${record.animationStyle}, ${record.animation.motionPrinciples.join(", ")}`,
          record.scores.animationScore
        )
      );
    }

    if (record.cinematic.visualContinuity >= 80) {
      learned.push(
        this.createPattern(
          record,
          "cinematic",
          `Cinematic: ${record.cinematic.cameraLanguage}, grading ${record.cinematic.colorGrading}`,
          record.cinematic.visualContinuity
        )
      );
    }

    if (record.social.bestPractices.length >= 2) {
      learned.push(
        this.createPattern(
          record,
          "social",
          `${record.platform}: ${record.social.hookStrategy}`,
          record.scores.marketingReadinessScore
        )
      );
    }

    learned.push(
      this.createPattern(
        record,
        "direction",
        `Style ${record.creativeStyle} for ${record.brandName}`,
        record.scores.creativeQualityScore
      )
    );

    if (record.domain) {
      learned.push(
        this.createPattern(
          record,
          "workflow",
          `Workflow: ${record.domain} on ${record.platform}`,
          record.scores.aiConfidenceScore
        )
      );
    }

    for (const pattern of learned) {
      this.patterns.add(pattern);
    }

    if (learned.length > 0) {
      this.logger.log("info", "learning", "Creative patterns learned", {
        creativeId: record.creativeId,
        patterns: learned.length,
      });
    }

    return learned;
  }

  private createPattern(
    record: CreativeAnalysisRecord,
    patternType: CreativeKnowledgeLearningPattern["patternType"],
    description: string,
    confidence: number
  ): CreativeKnowledgeLearningPattern {
    return {
      patternId: `ckpat-${crypto.randomBytes(4).toString("hex")}`,
      patternType,
      description,
      sourceCreativeId: record.creativeId,
      confidence: Math.min(100, confidence),
      detectedAt: new Date().toISOString(),
    };
  }
}
