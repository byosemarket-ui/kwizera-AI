import crypto from "node:crypto";
import { VideoAnalysisRecord, VideoLearningPattern } from "./types.js";
import { VideoPatternStore } from "./video-stores.js";
import { VideoKnowledgeLogger } from "./video-logger.js";

export class VideoLearner {
  constructor(
    private readonly patterns: VideoPatternStore,
    private readonly logger: VideoKnowledgeLogger
  ) {}

  learnFromAnalysis(record: VideoAnalysisRecord): VideoLearningPattern[] {
    const learned: VideoLearningPattern[] = [];

    if (record.scores.storytellingScore >= 75) {
      learned.push(
        this.createPattern(
          record,
          "storytelling",
          `Effective story flow: ${record.structure.storyFlow} with ${record.structure.sceneSequence.length} scenes`,
          record.scores.storytellingScore
        )
      );
    }

    if (record.scores.editingScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "editing",
          `${record.editing.editingStyle} editing with ${record.editing.transitionTechniques.join(", ")} transitions`,
          record.scores.editingScore
        )
      );
    }

    if (record.scores.marketingScore >= 78) {
      learned.push(
        this.createPattern(
          record,
          "marketing",
          `Marketing flow: hook at ${record.marketing.hookTiming}s, CTA at ${record.marketing.callToActionPlacement}`,
          record.scores.marketingScore
        )
      );
    }

    if (record.scores.audioScore >= 80) {
      learned.push(
        this.createPattern(
          record,
          "audio",
          `Audio: ${record.audio.backgroundMusic} with beat sync ${record.audio.beatSynchronization}`,
          record.scores.audioScore
        )
      );
    }

    const showcaseScene = record.structure.sceneSequence.find((s) => s.scenePurpose === "product-showcase");
    if (showcaseScene) {
      learned.push(
        this.createPattern(
          record,
          "camera",
          `Product showcase: ${showcaseScene.cameraMovement} with ${showcaseScene.composition} composition`,
          showcaseScene.productVisibility
        )
      );
    }

    for (const pattern of learned) {
      this.patterns.add(pattern);
    }

    if (learned.length > 0) {
      this.logger.log("info", "learning", "Video patterns learned", {
        videoId: record.videoId,
        patterns: learned.length,
      });
    }

    return learned;
  }

  private createPattern(
    record: VideoAnalysisRecord,
    patternType: VideoLearningPattern["patternType"],
    description: string,
    confidence: number
  ): VideoLearningPattern {
    return {
      patternId: `vidpat-${crypto.randomBytes(4).toString("hex")}`,
      patternType,
      description,
      sourceVideoId: record.videoId,
      confidence: Math.min(100, confidence),
      detectedAt: new Date().toISOString(),
    };
  }
}
