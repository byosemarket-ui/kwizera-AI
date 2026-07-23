import crypto from "node:crypto";
import { VideoPatternStore } from "./video-pattern-store.js";
import { SceneMemory, VideoPattern, VideoRecord, VideoStatus } from "./types.js";

const MIN_SCENE_COUNT = 2;
const MIN_CONFIDENCE = 55;

export class VideoPatternDetector {
  constructor(private readonly patternStore: VideoPatternStore) {}

  detect(video: VideoRecord): VideoPattern[] {
    const detected: VideoPattern[] = [];
    const now = new Date().toISOString();

    if (video.scenes.length >= MIN_SCENE_COUNT) {
      const structure = video.scenes.map((s) => s.scenePurpose).join(" → ");
      detected.push(
        this.createPattern("scene-structure", `Scene flow: ${structure}`, video.videoId, 75, now)
      );
    }

    const transitions = [...new Set(video.scenes.map((s) => s.transitionType).filter(Boolean))];
    for (const transition of transitions) {
      detected.push(
        this.createPattern(
          "transition",
          `Successful transition: ${transition}`,
          video.videoId,
          70,
          now
        )
      );
    }

    const productScenes = video.scenes.filter((s) => s.productFocus);
    if (productScenes.length > 0) {
      detected.push(
        this.createPattern(
          "product-presentation",
          `Product focus in ${productScenes.length} scene(s)`,
          video.videoId,
          72,
          now
        )
      );
    }

    if (video.marketing.hook && video.marketing.callToAction) {
      detected.push(
        this.createPattern(
          "marketing-flow",
          `Hook→CTA: ${video.marketing.hook.slice(0, 40)}... → ${video.marketing.callToAction}`,
          video.videoId,
          80,
          now
        )
      );
    }

    const animations = [...new Set(video.scenes.map((s) => s.animationStyle).filter(Boolean))];
    for (const anim of animations) {
      detected.push(
        this.createPattern("animation", `Animation style: ${anim}`, video.videoId, 68, now)
      );
    }

    if (video.marketing.brandingStyle || video.visual.logoAnimation) {
      detected.push(
        this.createPattern(
          "branding",
          `Branding: ${video.marketing.brandingStyle || video.visual.introStyle} / ${video.visual.logoAnimation}`,
          video.videoId,
          74,
          now
        )
      );
    }

    const qualified = detected.filter((p) => p.confidence >= MIN_CONFIDENCE);
    for (const pattern of qualified) {
      this.patternStore.store(pattern);
    }

    return qualified;
  }

  detectFromScenes(scenes: SceneMemory[], videoId: string): VideoPattern[] {
    const partial: VideoRecord = {
      videoId,
      memoryId: videoId,
      projectId: "",
      videoName: "",
      productType: "",
      brand: "",
      category: "",
      targetAudience: "",
      marketingGoal: "",
      language: "en",
      duration: 0,
      resolution: "",
      aspectRatio: "",
      exportFormat: "",
      status: VideoStatus.Completed,
      creationDate: "",
      lastModified: "",
      scenes,
      audio: {
        backgroundMusic: "",
        voiceStyle: "",
        voiceLanguage: "",
        narration: "",
        soundEffects: [],
        audioTiming: "",
        audioQuality: "",
      },
      marketing: {
        hook: "",
        callToAction: "",
        sellingPoints: [],
        emotionalStrategy: "",
        brandingStyle: "",
        productPresentationStyle: "",
        marketingStructure: "",
      },
      visual: {
        productPosition: "",
        lightingStyle: "",
        colorPalette: [],
        typography: "",
        iconStyle: "",
        motionStyle: "",
        introStyle: "",
        outroStyle: "",
        logoAnimation: "",
      },
      scores: {
        videoQualityScore: 0,
        marketingScore: 0,
        aiConfidenceScore: 0,
        learningScore: 0,
        userSatisfaction: 0,
        exportQuality: 0,
      },
      exportHistory: [],
      patterns: [],
      relatedMemories: [],
      lessonsLearned: [],
      strengths: [],
      weaknesses: [],
      versions: [],
      tags: [],
      keywords: [],
    };
    return this.detect(partial);
  }

  private createPattern(
    type: VideoPattern["patternType"],
    description: string,
    sourceVideoId: string,
    confidence: number,
    detectedAt: string
  ): VideoPattern {
    return {
      patternId: `pat-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      patternType: type,
      description,
      sourceVideoId,
      confidence,
      reusable: confidence >= 60,
      detectedAt,
    };
  }
}
