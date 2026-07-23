import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { VideoEnhancementPlatformOptimizer } from "./video-enhancement-platform-optimizer.js";
import {
  AudioEnhancementPlan,
  CinematicEnhancementPlan,
  VideoEnhancementPlatform,
  EnhancementProfile,
  EnhancementRecommendation,
  EnhancementType,
  EnhancementVersionEntry,
  MotionEnhancementPlan,
  NonDestructivePolicy,
  PlatformOptimizationRule,
  VideoQualityAnalysis,
  VisualEnhancementPlan,
} from "./types.js";

export class VideoEnhancementAnalyzer {
  private readonly platformOptimizer = new VideoEnhancementPlatformOptimizer();

  analyze(
    analysis: VideoAnalysisIntelligenceRecord,
    sceneDetection: SceneDetectionRecord,
    timeline: TimelineIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    motion: MotionIntelligenceRecord | null | undefined,
    style: VideoStyleIntelligenceRecord | null | undefined,
    understanding: VideoUnderstandingRecord | null | undefined,
    projectId?: string,
    platform?: VideoEnhancementPlatform
  ): {
    profile: EnhancementProfile;
    qualityAnalysis: VideoQualityAnalysis;
    visualPlan: VisualEnhancementPlan;
    audioPlan: AudioEnhancementPlan;
    motionPlan: MotionEnhancementPlan;
    cinematicPlan: CinematicEnhancementPlan;
    platformOptimizations: PlatformOptimizationRule[];
    nonDestructive: NonDestructivePolicy;
    versionHistory: EnhancementVersionEntry[];
    recommendations: EnhancementRecommendation[];
    keywords: string[];
  } {
    const targetPlatform = platform ?? this.inferPlatform(analysis);
    const qualityAnalysis = this.analyzeQuality(analysis, motion, camera);
    const visualPlan = this.buildVisualPlan(analysis, style, qualityAnalysis);
    const audioPlan = this.buildAudioPlan(analysis, timeline);
    const motionPlan = this.buildMotionPlan(analysis, motion, camera, qualityAnalysis);
    const cinematicPlan = this.buildCinematicPlan(style, camera);
    const platformOptimizations = this.platformOptimizer.buildPlatformRules(
      targetPlatform,
      analysis.classification.videoType,
      analysis.technical.orientation
    );
    const nonDestructive = this.buildNonDestructivePolicy(analysis);
    const profile = this.buildProfile(analysis, projectId, targetPlatform, 1);
    const recommendations = this.buildRecommendations(
      qualityAnalysis,
      visualPlan,
      audioPlan,
      motionPlan,
      platformOptimizations,
      style
    );
    const versionHistory: EnhancementVersionEntry[] = [
      {
        version: 1,
        timestamp: new Date().toISOString(),
        changeSummary: "Initial non-destructive enhancement plan",
        reversible: true,
      },
    ];
    const keywords = [
      ...analysis.keywords,
      targetPlatform,
      ...recommendations.map((r) => r.category),
      profile.brand,
    ];

    void sceneDetection;
    void understanding;

    return {
      profile,
      qualityAnalysis,
      visualPlan,
      audioPlan,
      motionPlan,
      cinematicPlan,
      platformOptimizations,
      nonDestructive,
      versionHistory,
      recommendations,
      keywords,
    };
  }

  private inferPlatform(analysis: VideoAnalysisIntelligenceRecord): VideoEnhancementPlatform {
    const hint = analysis.technical.metadata?.platform?.toLowerCase() ?? "";
    if (hint.includes("tiktok")) return VideoEnhancementPlatform.TikTok;
    if (hint.includes("reel") || hint.includes("instagram")) return VideoEnhancementPlatform.Instagram;
    if (hint.includes("youtube")) return VideoEnhancementPlatform.YouTube;
    if (hint.includes("facebook")) return VideoEnhancementPlatform.Facebook;
    if (hint.includes("whatsapp")) return VideoEnhancementPlatform.WhatsApp;
    if (analysis.classification.videoType === VideoAnalysisType.SocialMedia) {
      return VideoEnhancementPlatform.Instagram;
    }
    if (analysis.classification.videoType === VideoAnalysisType.Tutorial) {
      return VideoEnhancementPlatform.YouTube;
    }
    if (analysis.classification.videoType === VideoAnalysisType.Commercial) {
      return VideoEnhancementPlatform.Website;
    }
    return VideoEnhancementPlatform.YouTube;
  }

  private analyzeQuality(
    analysis: VideoAnalysisIntelligenceRecord,
    motion: MotionIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined
  ): VideoQualityAnalysis {
    const resolution = Math.min(
      100,
      Math.round((analysis.technical.width * analysis.technical.height) / (1920 * 1080) * 80)
    );

    return {
      resolution,
      frameQuality: analysis.scores.frameQualityScore,
      motionQuality: motion?.scores.motionQualityScore ?? Math.round(analysis.frame.motionDensity * 0.9),
      stabilization:
        camera?.scores.stabilityScore ??
        Math.round(analysis.visual.visualStability * 0.85 + analysis.frame.frameConsistencyScore * 0.15),
      noise: Math.max(0, 100 - Math.round(analysis.visual.noise)),
      compressionArtifacts: Math.max(0, 100 - Math.round((100 - analysis.scores.technicalQualityScore) * 0.8)),
      lighting: Math.round(analysis.visual.brightness * 0.5 + analysis.visual.exposure * 0.5),
      colorAccuracy: Math.round(analysis.visual.whiteBalance * 0.4 + analysis.visual.saturation * 0.3 + 30),
      visualClarity: Math.round(analysis.visual.sharpness * 0.6 + analysis.visual.contrast * 0.4),
      audioQuality: analysis.scores.audioQualityScore,
    };
  }

  private buildVisualPlan(
    analysis: VideoAnalysisIntelligenceRecord,
    style: VideoStyleIntelligenceRecord | null | undefined,
    quality: VideoQualityAnalysis
  ): VisualEnhancementPlan {
    const needsNoise = quality.noise < 70;
    const needsStab = quality.stabilization < 75;
    const needsSharp = quality.visualClarity < 80;

    return {
      resolutionEnhancement:
        quality.resolution < 80
          ? `Upscale plan to ${analysis.technical.width < 1920 ? "1920x1080" : "maintain native"} with AI-assisted scaling`
          : "Maintain native resolution — no upscale required",
      frameEnhancement:
        quality.frameQuality < 80
          ? "Apply frame consistency repair on flagged segments"
          : "Frame quality acceptable — minor polish only",
      noiseReduction: needsNoise ? "Apply temporal + spatial noise reduction at medium strength" : "Light noise pass only",
      stabilizationPlanning: needsStab
        ? "Plan warp-stabilize on handheld segments; lock tripod shots"
        : "Stabilization optional — footage already stable",
      colorCorrectionPlanning: `Balance exposure (current ${quality.lighting}/100); correct white balance drift`,
      colorGradingPlanning:
        style?.visualStyle.colorGradingStyle ?? "Apply balanced cinematic grade aligned with brand palette",
      lightingEnhancement:
        quality.lighting < 70 ? "Lift shadows + recover highlights in underexposed scenes" : "Fine-tune midtone contrast",
      contrastEnhancement:
        analysis.visual.contrast < 65 ? "Increase local contrast for product clarity" : "Preserve existing contrast curve",
      sharpnessEnhancement: needsSharp ? "Apply unsharp mask at 15-25% on hero product frames" : "Minimal sharpening pass",
      backgroundEnhancement:
        analysis.frame.visualComplexity > 60 ? "Selective background softening for subject isolation" : "Background clean — no change",
    };
  }

  private buildAudioPlan(
    analysis: VideoAnalysisIntelligenceRecord,
    timeline: TimelineIntelligenceRecord | null | undefined
  ): AudioEnhancementPlan {
    const audioScore = analysis.scores.audioQualityScore;
    const syncScore = timeline?.synchronization.overallSyncScore ?? analysis.audio.synchronizationScore;

    return {
      noiseReduction: audioScore < 75 ? "Apply broadband noise reduction on voice tracks" : "Light noise gate only",
      voiceEnhancement: audioScore < 80 ? "EQ boost 2-5kHz; de-ess sibilance" : "Voice clarity acceptable",
      musicOptimization: "Sidechain duck music -3dB under dialogue; balance stem levels",
      audioSynchronization: `Maintain sync at ${syncScore}/100; align cuts to audio transients`,
      loudnessNormalization: "Normalize to -14 LUFS integrated (platform-adjustable)",
      echoReduction: audioScore < 70 ? "Apply light de-reverb on dialogue segments" : "No echo treatment required",
      audioClarity: audioScore < 78 ? "Multiband compression for vocal intelligibility" : "Clarity pass only",
    };
  }

  private buildMotionPlan(
    analysis: VideoAnalysisIntelligenceRecord,
    motion: MotionIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined,
    quality: VideoQualityAnalysis
  ): MotionEnhancementPlan {
    return {
      motionSmoothing:
        quality.motionQuality < 75
          ? "Apply optical flow smoothing on high-intensity segments"
          : "Motion smoothness acceptable",
      motionConsistency:
        motion && motion.metrics.continuity < 80
          ? `Improve continuity from ${motion.metrics.continuity} to target 85+`
          : "Maintain existing motion consistency",
      cameraStabilization:
        quality.stabilization < 75
          ? `Stabilize ${camera?.dominantMovement ?? "handheld"} segments`
          : "Camera stability sufficient",
      motionContinuity:
        motion?.motionPlan.motionContinuity
          ? `Preserve continuity score ${motion.motionPlan.motionContinuity} across scene boundaries`
          : "Align motion beats to scene cuts",
      frameInterpolationPrep:
        quality.motionQuality < 70 && analysis.technical.fps < 30
          ? "Prepare 24→30fps interpolation nodes for slow-motion segments"
          : "No frame interpolation required",
    };
  }

  private buildCinematicPlan(
    style: VideoStyleIntelligenceRecord | null | undefined,
    camera: CameraMovementRecord | null | undefined
  ): CinematicEnhancementPlan {
    return {
      styleAlignment: style
        ? `Align grade and pacing to ${style.dominantCinematicStyle} style profile`
        : "Apply neutral cinematic polish",
      pacingOptimization: style?.editingStyle.pacing
        ? `Optimize pacing for ${style.editingStyle.pacing} rhythm`
        : "Maintain editorial pacing",
      transitionRefinement: style?.editingStyle.transitionStyle ?? "Refine transitions at scene boundaries",
      colorGradingCinematic:
        style?.visualStyle.colorGradingStyle ?? camera?.movementPlan.cinematicStyle ?? "Cinematic color pass",
    };
  }

  private buildNonDestructivePolicy(analysis: VideoAnalysisIntelligenceRecord): NonDestructivePolicy {
    return {
      preserveOriginal: true,
      supportsUndo: true,
      supportsRedo: true,
      supportsRecovery: true,
      versionHistoryEnabled: true,
      originalAssetRef: analysis.technical.filePath ?? `video://${analysis.videoId}/original`,
    };
  }

  private buildProfile(
    analysis: VideoAnalysisIntelligenceRecord,
    projectId: string | undefined,
    platform: VideoEnhancementPlatform,
    version: number
  ): EnhancementProfile {
    return {
      enhancementPlanId: `enhance-plan-${analysis.videoId}`,
      projectId: projectId ?? analysis.relationships.relatedProjects[0] ?? `project-${analysis.videoId}`,
      videoId: analysis.videoId,
      product: analysis.relationships.relatedProducts[0] ?? "",
      brand: analysis.relationships.relatedBrands[0] ?? "",
      campaign: analysis.relationships.relatedCampaigns[0] ?? "",
      platform,
      enhancementVersion: version,
    };
  }

  private buildRecommendations(
    quality: VideoQualityAnalysis,
    visual: VisualEnhancementPlan,
    audio: AudioEnhancementPlan,
    motion: MotionEnhancementPlan,
    platforms: PlatformOptimizationRule[],
    style: VideoStyleIntelligenceRecord | null | undefined
  ): EnhancementRecommendation[] {
    const recs: EnhancementRecommendation[] = [];

    if (quality.visualClarity < 75) {
      recs.push({
        category: EnhancementType.Visual,
        suggestion: visual.sharpnessEnhancement,
        priority: "high",
        reason: `Visual clarity ${quality.visualClarity}/100`,
        nonDestructive: true,
      });
    }
    if (quality.audioQuality < 75) {
      recs.push({
        category: EnhancementType.Audio,
        suggestion: audio.voiceEnhancement,
        priority: "high",
        reason: `Audio quality ${quality.audioQuality}/100`,
        nonDestructive: true,
      });
    }
    if (quality.stabilization < 70) {
      recs.push({
        category: EnhancementType.Stabilization,
        suggestion: visual.stabilizationPlanning,
        priority: "high",
        reason: `Stabilization ${quality.stabilization}/100`,
        nonDestructive: true,
      });
    }
    if (quality.motionQuality < 70) {
      recs.push({
        category: EnhancementType.Motion,
        suggestion: motion.motionSmoothing,
        priority: "medium",
        reason: `Motion quality ${quality.motionQuality}/100`,
        nonDestructive: true,
      });
    }
    if (quality.noise < 65) {
      recs.push({
        category: EnhancementType.Restoration,
        suggestion: visual.noiseReduction,
        priority: "medium",
        reason: `Noise score ${quality.noise}/100`,
        nonDestructive: true,
      });
    }
    const topPlatform = platforms.find((p) => p.priority === "high");
    if (topPlatform) {
      recs.push({
        category: EnhancementType.Platform,
        suggestion: `Optimize for ${topPlatform.platform}: ${topPlatform.resolutionTarget}`,
        priority: "high",
        reason: `Primary platform ${topPlatform.platform}`,
        nonDestructive: true,
      });
    }
    if (style) {
      recs.push({
        category: EnhancementType.Cinematic,
        suggestion: `Apply ${style.dominantCinematicStyle} color grade from style profile`,
        priority: "medium",
        reason: "Style intelligence linked",
        nonDestructive: true,
      });
    }
    recs.push({
      category: EnhancementType.Color,
      suggestion: visual.colorGradingPlanning,
      priority: "low",
      reason: "Brand-aligned color enhancement",
      nonDestructive: true,
    });
    return recs;
  }
}
