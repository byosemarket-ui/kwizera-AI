import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import { SceneClassification } from "../scene-detection-intelligence-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { VideoStoryType } from "../video-understanding-engine/types.js";
import { CreativeVideoTemplateLibrary } from "./creative-video-template-library.js";
import {
  CreativeAudioPlan,
  CreativeMarketingPlan,
  CreativeRecommendation,
  CreativeStructure,
  CreativeVideoPlatform,
  CreativeVideoProfile,
  CreativeVideoTemplate,
  CreativeVideoType,
  CreativeVisualPlan,
  PlatformCreativePlan,
  ProductionInstructions,
  StoryboardPlan,
} from "./types.js";

export class CreativeVideoAnalyzer {
  private readonly templateLibrary = new CreativeVideoTemplateLibrary();

  analyze(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    understanding: VideoUnderstandingRecord | null | undefined,
    style: VideoStyleIntelligenceRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    enhancement: VideoEnhancementPlanRecord | null | undefined,
    projectId?: string,
    platform?: CreativeVideoPlatform,
    creativeType?: CreativeVideoType
  ): {
    profile: CreativeVideoProfile;
    creativeType: CreativeVideoType;
    storyboard: StoryboardPlan;
    structure: CreativeStructure;
    visualPlan: CreativeVisualPlan;
    audioPlan: CreativeAudioPlan;
    marketingPlan: CreativeMarketingPlan;
    platformPlans: PlatformCreativePlan[];
    templates: CreativeVideoTemplate[];
    productionInstructions: ProductionInstructions;
    recommendations: CreativeRecommendation[];
    keywords: string[];
  } {
    const targetPlatform = platform ?? this.inferPlatform(analysis);
    const type = creativeType ?? this.inferCreativeType(analysis, understanding);
    const industry = understanding?.industry ?? analysis.classification.category;

    const profile = this.buildProfile(analysis, projectId, targetPlatform, 1);
    const storyboard = this.buildStoryboard(sceneDetection, understanding, analysis);
    const structure = this.buildStructure(understanding, storyboard);
    const visualPlan = this.buildVisualPlan(style, camera, motion, enhancement);
    const audioPlan = this.buildAudioPlan(analysis, style, enhancement);
    const marketingPlan = this.buildMarketingPlan(understanding, analysis, storyboard);
    const platformPlans = this.buildPlatformPlans(targetPlatform, analysis.classification.videoType);
    const templates = this.templateLibrary.matchTemplates(
      analysis.classification.videoType,
      type,
      industry
    );
    const productionInstructions = this.buildProductionInstructions(
      storyboard,
      visualPlan,
      audioPlan,
      enhancement
    );
    const recommendations = this.buildRecommendations(
      storyboard,
      marketingPlan,
      visualPlan,
      templates,
      enhancement
    );
    const keywords = [
      ...analysis.keywords,
      type,
      targetPlatform,
      profile.brand,
      storyboard.storyStructure,
    ];

    return {
      profile,
      creativeType: type,
      storyboard,
      structure,
      visualPlan,
      audioPlan,
      marketingPlan,
      platformPlans,
      templates,
      productionInstructions,
      recommendations,
      keywords,
    };
  }

  private inferPlatform(analysis: VideoAnalysisIntelligenceRecord): CreativeVideoPlatform {
    const hint = analysis.technical.metadata?.platform?.toLowerCase() ?? "";
    if (hint.includes("tiktok")) return CreativeVideoPlatform.TikTok;
    if (hint.includes("reel") || hint.includes("instagram")) return CreativeVideoPlatform.InstagramReels;
    if (hint.includes("youtube")) return CreativeVideoPlatform.YouTube;
    if (hint.includes("facebook")) return CreativeVideoPlatform.Facebook;
    if (hint.includes("whatsapp")) return CreativeVideoPlatform.WhatsApp;
    if (analysis.classification.videoType === VideoAnalysisType.SocialMedia) {
      return CreativeVideoPlatform.InstagramReels;
    }
    if (analysis.classification.videoType === VideoAnalysisType.Tutorial) {
      return CreativeVideoPlatform.YouTube;
    }
    return CreativeVideoPlatform.Website;
  }

  private inferCreativeType(
    analysis: VideoAnalysisIntelligenceRecord,
    understanding: VideoUnderstandingRecord | null | undefined
  ): CreativeVideoType {
    if (understanding?.story.storyType === VideoStoryType.ProductDemo) return CreativeVideoType.ProductDemo;
    if (understanding?.story.storyType === VideoStoryType.BrandStory) return CreativeVideoType.BrandStory;
    if (analysis.classification.videoType === VideoAnalysisType.SocialMedia) return CreativeVideoType.Social;
    if (analysis.classification.videoType === VideoAnalysisType.Tutorial) return CreativeVideoType.Educational;
    if (analysis.classification.videoType === VideoAnalysisType.Commercial) return CreativeVideoType.Commercial;
    return CreativeVideoType.Promotional;
  }

  private buildProfile(
    analysis: VideoAnalysisIntelligenceRecord,
    projectId: string | undefined,
    platform: CreativeVideoPlatform,
    version: number
  ): CreativeVideoProfile {
    return {
      creativeVideoId: `creative-video-${analysis.videoId}`,
      projectId: projectId ?? analysis.relationships.relatedProjects[0] ?? `project-${analysis.videoId}`,
      videoId: analysis.videoId,
      product: analysis.relationships.relatedProducts[0] ?? "",
      brand: analysis.relationships.relatedBrands[0] ?? "",
      campaign: analysis.relationships.relatedCampaigns[0] ?? "",
      platform,
      creativeVersion: version,
    };
  }

  private buildStoryboard(
    sceneDetection: SceneDetectionRecord,
    understanding: VideoUnderstandingRecord | null | undefined,
    analysis: VideoAnalysisIntelligenceRecord
  ): StoryboardPlan {
    const scenes = sceneDetection.scenes;
    const sceneOrder = scenes.map((s) => s.sceneId);
    const sceneTiming = scenes.map((s) => ({
      sceneId: s.sceneId,
      startMs: s.startMs,
      endMs: s.endMs,
      label: s.classification,
    }));

    const productScene = scenes.find((s) => s.classification === SceneClassification.ProductDemo);
    const brandScene = scenes.find((s) => s.classification === SceneClassification.BrandScene);
    const ctaScene = scenes.find((s) => s.classification === SceneClassification.Cta);
    const hookScene = scenes.find((s) => s.classification === SceneClassification.Hook) ?? scenes[0];

    return {
      storyStructure:
        understanding?.story.narrativeStructure ?? "Hook → Build → Reveal → CTA → Close",
      openingHook:
        hookScene
          ? `${hookScene.classification} hook in first ${Math.min(3, Math.ceil(hookScene.durationMs / 1000))}s`
          : "Attention hook in opening 3 seconds",
      sceneOrder,
      sceneTiming,
      productReveal: {
        sceneId: productScene?.sceneId ?? scenes[Math.floor(scenes.length / 2)]?.sceneId ?? "scene-1",
        timingMs: productScene?.startMs ?? Math.floor(analysis.technical.durationMs * 0.35),
        strategy: "Hero product introduction with feature callouts",
      },
      brandReveal: {
        sceneId: brandScene?.sceneId ?? scenes[scenes.length - 1]?.sceneId ?? "scene-end",
        timingMs: brandScene?.startMs ?? Math.floor(analysis.technical.durationMs * 0.75),
        strategy: "Brand logo and identity reinforcement",
      },
      ctaPlacement: {
        sceneId: ctaScene?.sceneId ?? scenes[scenes.length - 1]?.sceneId ?? "scene-end",
        timingMs: ctaScene?.startMs ?? Math.floor(analysis.technical.durationMs * 0.85),
        strategy: "Direct CTA with offer and urgency",
      },
      endingStrategy:
        scenes.some((s) => s.classification === SceneClassification.Outro)
          ? "Branded outro with logo hold and tagline"
          : "Clean fade to brand card with CTA overlay",
    };
  }

  private buildStructure(
    understanding: VideoUnderstandingRecord | null | undefined,
    storyboard: StoryboardPlan
  ): CreativeStructure {
    return {
      storyFlow: understanding?.story.storyFlow ?? storyboard.storyStructure,
      emotionalFlow: understanding?.story.emotionalJourney ?? "Curiosity → Interest → Desire → Action",
      marketingFlow: understanding?.marketing.campaignGoal ?? "Awareness → Consideration → Conversion",
      viewerJourney: understanding?.audience.viewerInterest ?? "Discover → Evaluate → Decide",
      conversionJourney: "Attention → Interest → Product proof → CTA → Conversion",
    };
  }

  private buildVisualPlan(
    style: VideoStyleIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined,
    enhancement: VideoEnhancementPlanRecord | null | undefined
  ): CreativeVisualPlan {
    return {
      cameraStyle: camera?.movementPlan.recommendedMovement ?? style?.visualStyle.cameraStyle ?? "Dynamic cinematic",
      motionStyle: motion?.dominantClassification ?? style?.visualStyle.motionStyle ?? "Controlled motion",
      sceneComposition: style?.visualStyle.compositionStyle ?? "Rule-of-thirds with hero framing",
      lightingStyle: style?.visualStyle.lightingStyle ?? enhancement?.visualPlan.lightingEnhancement ?? "Balanced three-point",
      colorStyle: style?.visualStyle.colorGradingStyle ?? enhancement?.visualPlan.colorGradingPlanning ?? "Brand-aligned grade",
      typographyStyle: style?.visualStyle.typographyStyle ?? "Bold sans-serif overlays",
      graphicStyle: style?.visualStyle.graphicStyle ?? "Minimal brand graphics",
      transitionStyle: style?.editingStyle.transitionStyle ?? "Motivated cuts with dissolve accents",
      effectStyle: style?.editingStyle.effectStyle ?? enhancement?.visualPlan.sharpnessEnhancement ?? "Subtle polish",
    };
  }

  private buildAudioPlan(
    analysis: VideoAnalysisIntelligenceRecord,
    style: VideoStyleIntelligenceRecord | null | undefined,
    enhancement: VideoEnhancementPlanRecord | null | undefined
  ): CreativeAudioPlan {
    const isSocial = analysis.classification.videoType === VideoAnalysisType.SocialMedia;
    return {
      voiceStyle: isSocial ? "Energetic conversational VO" : "Professional authoritative VO",
      musicStyle: isSocial ? "Trend-forward upbeat track" : "Cinematic corporate underscore",
      soundEffects: "Subtle UI and transition SFX; product interaction sounds on reveal",
      audioTiming: style?.editingStyle.audioSyncStyle ?? "Beat-synced cuts on hook and CTA",
      audioMood: understandingMoodFallback(style) ?? "Confident and aspirational",
      audioSynchronization:
        enhancement?.audioPlan.audioSynchronization ?? `Sync to ${analysis.audio.synchronizationScore}/100`,
    };
  }

  private buildMarketingPlan(
    understanding: VideoUnderstandingRecord | null | undefined,
    analysis: VideoAnalysisIntelligenceRecord,
    storyboard: StoryboardPlan
  ): CreativeMarketingPlan {
    const hasProduct = analysis.relationships.relatedProducts.length > 0;
    return {
      productShowcase: hasProduct
        ? `Hero showcase at ${storyboard.productReveal.timingMs}ms with feature highlights`
        : "Brand-led value proposition showcase",
      offerPresentation: understanding?.marketing.offerPresentation ?? "Limited-time offer in CTA scene",
      brandAwareness: understanding?.brand.brandMessaging ?? `${analysis.relationships.relatedBrands[0] ?? "Brand"} identity reinforcement`,
      socialEngagement: "Shareable hook + caption-ready moments",
      leadGeneration: "CTA drives landing page or sign-up funnel",
      ctaStrategy: storyboard.ctaPlacement.strategy,
    };
  }

  private buildPlatformPlans(
    primary: CreativeVideoPlatform,
    videoType: VideoAnalysisType
  ): PlatformCreativePlan[] {
    const all: CreativeVideoPlatform[] = [
      CreativeVideoPlatform.TikTok,
      CreativeVideoPlatform.InstagramReels,
      CreativeVideoPlatform.Facebook,
      CreativeVideoPlatform.YouTube,
      CreativeVideoPlatform.WhatsApp,
      CreativeVideoPlatform.Website,
      CreativeVideoPlatform.Television,
    ];

    return all.map((platform) => ({
      platform,
      hookStrategy:
        platform === CreativeVideoPlatform.TikTok || platform === CreativeVideoPlatform.InstagramReels
          ? "3-second pattern interrupt hook"
          : "5-second value proposition hook",
      pacing: videoType === VideoAnalysisType.SocialMedia ? "Fast (2-3s per beat)" : "Moderate narrative pacing",
      formatNotes: this.platformNotes(platform),
      priority: platform === primary ? "high" : videoType === VideoAnalysisType.SocialMedia && this.isSocialPlatform(platform) ? "medium" : "low",
    }));
  }

  private isSocialPlatform(platform: CreativeVideoPlatform): boolean {
    return (
      platform === CreativeVideoPlatform.TikTok ||
      platform === CreativeVideoPlatform.InstagramReels ||
      platform === CreativeVideoPlatform.Facebook
    );
  }

  private platformNotes(platform: CreativeVideoPlatform): string[] {
    const notes: Record<CreativeVideoPlatform, string[]> = {
      [CreativeVideoPlatform.TikTok]: ["Vertical 9:16", "Native captions", "Trend audio optional"],
      [CreativeVideoPlatform.InstagramReels]: ["Vertical safe zones", "Bold text overlays", "Music-driven"],
      [CreativeVideoPlatform.Facebook]: ["Square or 16:9", "Silent-first captions", "Thumb-stopping opener"],
      [CreativeVideoPlatform.YouTube]: ["16:9 cinematic", "Chapter markers", "End screen CTA"],
      [CreativeVideoPlatform.WhatsApp]: ["Compressed-friendly", "Short duration", "Clear CTA text"],
      [CreativeVideoPlatform.Website]: ["Hero loop", "Muted autoplay safe", "Brand-forward"],
      [CreativeVideoPlatform.Television]: ["Broadcast safe", "Legal supers", "15/30s variants"],
    };
    return notes[platform];
  }

  private buildProductionInstructions(
    storyboard: StoryboardPlan,
    visual: CreativeVisualPlan,
    audio: CreativeAudioPlan,
    enhancement: VideoEnhancementPlanRecord | null | undefined
  ): ProductionInstructions {
    return {
      preProduction: [
        `Storyboard: ${storyboard.storyStructure}`,
        `Scene count: ${storyboard.sceneOrder.length}`,
        `Hook: ${storyboard.openingHook}`,
      ],
      production: [
        `Camera: ${visual.cameraStyle}`,
        `Lighting: ${visual.lightingStyle}`,
        `Audio: ${audio.voiceStyle}`,
      ],
      postProduction: [
        `Color: ${visual.colorStyle}`,
        `Transitions: ${visual.transitionStyle}`,
        enhancement ? `Enhancement: ${enhancement.profile.enhancementPlanId}` : "Run enhancement planning pass",
      ],
      delivery: [
        `CTA at ${storyboard.ctaPlacement.timingMs}ms`,
        `Ending: ${storyboard.endingStrategy}`,
        "Export per platform optimization specs",
      ],
    };
  }

  private buildRecommendations(
    storyboard: StoryboardPlan,
    marketing: CreativeMarketingPlan,
    visual: CreativeVisualPlan,
    templates: CreativeVideoTemplate[],
    enhancement: VideoEnhancementPlanRecord | null | undefined
  ): CreativeRecommendation[] {
    const recs: CreativeRecommendation[] = [];
    const top = templates[0];

    if (storyboard.sceneOrder.length < 3) {
      recs.push({
        category: "storyboard",
        suggestion: "Expand storyboard to at least 3 scenes for narrative arc",
        priority: "high",
        reason: "Insufficient scene coverage",
      });
    }
    if (top) {
      recs.push({
        category: "storyboard",
        suggestion: `Apply ${top.name} template structure`,
        priority: "high",
        reason: `Template match ${top.matchScore}/100`,
      });
    }
    recs.push({
      category: "marketing",
      suggestion: marketing.ctaStrategy,
      priority: "high",
      reason: "Conversion-focused CTA placement",
    });
    recs.push({
      category: "visual",
      suggestion: `Maintain ${visual.colorStyle} across all scenes`,
      priority: "medium",
      reason: "Visual consistency",
    });
    recs.push({
      category: "audio",
      suggestion: `Use ${visual.transitionStyle} aligned with ${visual.cameraStyle} pacing`,
      priority: "medium",
      reason: "Audio-visual sync",
    });
    if (!enhancement) {
      recs.push({
        category: "production",
        suggestion: "Complete enhancement planning before final production lock",
        priority: "medium",
        reason: "Enhancement plan not linked",
      });
    }
    recs.push({
      category: "platform",
      suggestion: "Export platform-specific variants from primary creative master",
      priority: "low",
      reason: "Multi-platform distribution",
    });
    return recs;
  }
}

function understandingMoodFallback(style: VideoStyleIntelligenceRecord | null | undefined): string | undefined {
  return style?.dominantCinematicStyle ? `${style.dominantCinematicStyle} mood` : undefined;
}
