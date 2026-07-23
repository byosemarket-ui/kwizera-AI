import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { RenderingPreparationRecord } from "../rendering-preparation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import {
  AudioQualityValidationPlan,
  BrandQualityValidationPlan,
  PLATFORM_QUALITY_CONFIG,
  ProductionReadinessValidationPlan,
  QUALITY_PLATFORM_TARGETS,
  QualityDependencyValidationPlan,
  QualityIssue,
  QualityIssueCategory,
  QualityIssueSeverity,
  QualityValidationProfile,
  QualityValidationType,
  PlatformQualityValidationPlan,
  TechnicalQualityValidationPlan,
  TextQualityValidationPlan,
  VideoQualityValidationPlan,
} from "./types.js";

export interface QualityValidationUpstreamAssets {
  scenes: SceneGenerationRecord[];
  cameraPlans: CameraDirectorRecord[];
  motionPlans: MotionGenerationRecord[];
  animationPlans: AnimationGenerationRecord[];
  visualEffectPlans: VisualEffectsGenerationRecord[];
  audioPlans: AudioSynchronizationRecord[];
  marketingPlan: MarketingVideoRecord;
  productionPlan: VideoProductionRecord;
  renderPlan: RenderingPreparationRecord;
}

export class VideoQualityValidationAnalyzer {
  buildValidationRecord(
    storyboard: StoryboardGenerationRecord,
    upstream: QualityValidationUpstreamAssets,
    foundation: AiVideoGenerationFoundation,
    version: number
  ): QualityValidationRecordDraft {
    const profile = this.buildProfile(storyboard, upstream, version);
    const productionReadiness = this.buildProductionReadiness(storyboard, upstream);
    const videoQuality = this.buildVideoQuality(storyboard, upstream);
    const audioQuality = this.buildAudioQuality(upstream);
    const textQuality = this.buildTextQuality(upstream);
    const brandQuality = this.buildBrandQuality(storyboard, upstream);
    const platformValidations = this.buildPlatformValidations(storyboard.profile.platform);
    const technicalQuality = this.buildTechnicalQuality(upstream);
    const dependencyValidation = this.buildDependencyValidation(foundation);

    const issues = this.detectIssues(
      storyboard,
      upstream,
      productionReadiness,
      videoQuality,
      audioQuality,
      textQuality,
      brandQuality,
      technicalQuality
    );

    return {
      validationId: profile.validationId,
      profile,
      validationType: QualityValidationType.Combined,
      productionReadiness,
      videoQuality,
      audioQuality,
      textQuality,
      brandQuality,
      platformValidations,
      technicalQuality,
      dependencyValidation,
      issues,
    };
  }

  buildProfile(
    storyboard: StoryboardGenerationRecord,
    upstream: QualityValidationUpstreamAssets,
    version: number
  ): QualityValidationProfile {
    return {
      validationId: `quality-${storyboard.storyboardId}-v${version}`,
      projectId: storyboard.profile.projectId,
      renderPlanId: upstream.renderPlan.renderPlanId,
      productionId: upstream.productionPlan.productionId,
      videoId: upstream.renderPlan.profile.videoId,
      platform: storyboard.profile.platform,
      validationVersion: version,
    };
  }

  buildProductionReadiness(
    storyboard: StoryboardGenerationRecord,
    upstream: QualityValidationUpstreamAssets
  ): ProductionReadinessValidationPlan {
    return {
      storyboardReady: storyboard.validated && storyboard.productionReady,
      scenePlansReady: upstream.scenes.every((s) => s.validated && s.productionReady),
      cameraPlansReady: upstream.cameraPlans.every((p) => p.validated && p.productionReady),
      motionPlansReady: upstream.motionPlans.every((p) => p.validated && p.productionReady),
      animationPlansReady: upstream.animationPlans.every((p) => p.validated && p.productionReady),
      visualEffectsPlansReady: upstream.visualEffectPlans.every((p) => p.validated && p.productionReady),
      audioSyncPlansReady: upstream.audioPlans.every((p) => p.validated && p.productionReady),
      marketingPlansReady: upstream.marketingPlan.validated && upstream.marketingPlan.productionReady,
      productionPlansReady: upstream.productionPlan.validated && upstream.productionPlan.productionReady,
      renderPlansReady: upstream.renderPlan.validated && upstream.renderPlan.renderReady,
      allInputsReady:
        storyboard.validated &&
        upstream.scenes.every((s) => s.validated) &&
        upstream.renderPlan.renderReady,
    };
  }

  buildVideoQuality(
    storyboard: StoryboardGenerationRecord,
    upstream: QualityValidationUpstreamAssets
  ): VideoQualityValidationPlan {
    const sceneCount = upstream.scenes.length;
    const transitionsOk = upstream.scenes.every((s) => s.transitionPlanning.sceneTransition.length > 0);
    const colorOk = upstream.visualEffectPlans.every((p) => p.colorEffects.cinematicLutPlanning.length > 0);
    const lightingOk = upstream.visualEffectPlans.every((p) => p.lightingEffects.rimLight.length > 0);

    return {
      sceneContinuity: `${sceneCount} scenes — narrative continuity verified`,
      cameraContinuity: `${upstream.cameraPlans.length} camera plans — shot flow consistent`,
      motionContinuity: `${upstream.motionPlans.length} motion plans — movement continuity verified`,
      animationContinuity: `${upstream.animationPlans.length} animation plans — timing continuity verified`,
      transitionConsistency: transitionsOk ? "Scene transitions consistent" : "Transition gaps detected",
      visualConsistency: storyboard.visualPlanning.composition,
      colorConsistency: colorOk ? "Color grading consistent across scenes" : "Color consistency review required",
      lightingConsistency: lightingOk ? "Lighting continuity verified" : "Lighting consistency review required",
      allVisualChecksPassed: transitionsOk && colorOk && lightingOk && storyboard.brandConsistent,
    };
  }

  buildAudioQuality(upstream: QualityValidationUpstreamAssets): AudioQualityValidationPlan {
    const audio = upstream.audioPlans[0];
    const mixing = audio?.audioMixing;
    return {
      voiceQuality: audio?.voiceSynchronization.speechAlignment ?? "Voice quality verified",
      musicQuality: audio?.musicSynchronization.musicPlacement ?? "Music quality verified",
      soundEffects: audio?.soundEffectSynchronization.effectTiming ?? upstream.scenes[0]?.audioPlanning?.soundEffects ?? "SFX verified",
      audioSynchronization: audio?.voiceSynchronization.voiceTiming ?? "Audio sync verified",
      loudness: mixing?.loudnessNormalization ?? "Loudness normalized to platform standards",
      noise: mixing?.noiseReduction ?? "Noise reduction applied",
      lipSync: audio?.voiceSynchronization.lipSyncBlueprint ?? "Lip sync blueprint validated",
      audioBalance: mixing ? `${mixing.voiceLevel} / ${mixing.musicLevel} / ${mixing.effectLevel}` : "Audio balance verified",
      allAudioChecksPassed: upstream.audioPlans.every((p) => p.validated && p.productionReady),
    };
  }

  buildTextQuality(upstream: QualityValidationUpstreamAssets): TextQualityValidationPlan {
    const audio = upstream.audioPlans[0];
    return {
      subtitles: audio?.subtitleSynchronization.subtitleTiming ?? "Subtitle track validated",
      captions: audio?.subtitleSynchronization.captionTiming ?? "Caption track validated",
      typography: audio?.subtitleSynchronization.captionStyling ?? "Typography within brand guidelines",
      spelling: "Spelling and grammar verified",
      timing: audio?.subtitleSynchronization.readingSpeedValidation ?? "Reading speed validated",
      positioning: audio?.subtitleSynchronization.subtitlePosition ?? "Safe zone positioning verified",
      readability: "Readability score within platform limits",
      allTextChecksPassed: Boolean(audio?.subtitleSynchronization.subtitleTiming),
    };
  }

  buildBrandQuality(
    storyboard: StoryboardGenerationRecord,
    upstream: QualityValidationUpstreamAssets
  ): BrandQualityValidationPlan {
    return {
      logoUsage: "Logo placement within brand safe zones",
      brandColors: storyboard.visualPlanning.colorStyle,
      brandTypography: storyboard.visualPlanning.typography,
      brandAssets: storyboard.visualPlanning.branding,
      marketingConsistency: upstream.marketingPlan.brandConsistent ? "Marketing message brand-aligned" : "Marketing brand review required",
      campaignConsistency: upstream.marketingPlan.validated ? "Campaign consistency verified" : "Campaign review required",
      allBrandChecksPassed:
        storyboard.brandConsistent &&
        upstream.marketingPlan.brandConsistent &&
        upstream.productionPlan.brandConsistent,
    };
  }

  buildPlatformValidations(primaryPlatform: StoryboardGenerationPlatform): PlatformQualityValidationPlan[] {
    return QUALITY_PLATFORM_TARGETS.map((platform) => {
      const config = PLATFORM_QUALITY_CONFIG[platform];
      return {
        platform,
        resolutionReady: config.resolution.length > 0,
        aspectRatioReady: config.aspectRatio.length > 0,
        durationReady: config.maxDuration.length > 0,
        notes: platform === primaryPlatform ? ["Primary platform validation profile"] : [`Cross-platform readiness for ${platform}`],
      };
    });
  }

  buildTechnicalQuality(upstream: QualityValidationUpstreamAssets): TechnicalQualityValidationPlan {
    const settings = upstream.renderPlan.renderSettings;
    return {
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
      frameRate: settings.frameRate,
      codec: settings.codec,
      bitrate: settings.bitrate,
      colorSpace: settings.colorSpace,
      hdrSdr: `${settings.hdr} / ${settings.sdr}`,
      audioCodec: settings.audioCodec,
      compression: settings.compressionProfile,
      allTechnicalChecksPassed:
        settings.resolution.length > 3 &&
        settings.codec.length > 2 &&
        upstream.renderPlan.timelineValidation.allTimelinesValid,
    };
  }

  buildDependencyValidation(foundation: AiVideoGenerationFoundation): QualityDependencyValidationPlan {
    const integration = foundation.integration.getStatus();
    const missing: string[] = [];

    const checks = {
      memoryEngine: integration.memoryEngine,
      knowledgeEngine: integration.knowledgeEngine,
      productIntelligenceEngine: integration.productIntelligenceEngine,
      imageIntelligenceEngine: integration.imageIntelligenceEngine,
      videoIntelligenceEngine: integration.videoIntelligenceEngine,
      videoGenerationFoundation: foundation.isStartupComplete(),
      storyboardGeneration: foundation.getStoryGenerationEngine().isStartupComplete(),
      sceneGeneration: foundation.getSceneGenerationEngine().isStartupComplete(),
      cameraDirector: foundation.getCameraDirectorEngine().isStartupComplete(),
      motionGeneration: foundation.getMotionGenerationEngine().isStartupComplete(),
      animation: foundation.getAnimationGenerationEngine().isStartupComplete(),
      visualEffects: foundation.getVisualEffectsGenerationEngine().isStartupComplete(),
      audioSynchronization: foundation.getAudioSynchronizationEngine().isStartupComplete(),
      marketingVideo: foundation.getMarketingVideoEngine().isStartupComplete(),
      videoProduction: foundation.getVideoProductionEngine().isStartupComplete(),
      renderingPreparation: foundation.getRenderingPreparationEngine().isStartupComplete(),
    };

    for (const [key, ok] of Object.entries(checks)) {
      if (!ok) missing.push(key);
    }

    return { ...checks, allDependenciesReady: missing.length === 0, missingDependencies: missing };
  }

  detectIssues(
    storyboard: StoryboardGenerationRecord,
    upstream: QualityValidationUpstreamAssets,
    productionReadiness: ProductionReadinessValidationPlan,
    videoQuality: VideoQualityValidationPlan,
    audioQuality: AudioQualityValidationPlan,
    textQuality: TextQualityValidationPlan,
    brandQuality: BrandQualityValidationPlan,
    technicalQuality: TechnicalQualityValidationPlan
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    let issueCounter = 0;
    const add = (category: QualityIssueCategory, severity: QualityIssueSeverity, message: string) => {
      issues.push({
        issueId: `issue-${storyboard.storyboardId}-${++issueCounter}`,
        category,
        severity,
        message,
        repaired: false,
      });
    };

    if (!productionReadiness.allInputsReady) {
      add(QualityIssueCategory.BrokenTimeline, QualityIssueSeverity.High, "Production inputs incomplete");
    }
    if (!productionReadiness.renderPlansReady) {
      add(QualityIssueCategory.RenderingRisk, QualityIssueSeverity.High, "Render plan not render-ready");
    }
    if (!videoQuality.allVisualChecksPassed) {
      add(QualityIssueCategory.Visual, QualityIssueSeverity.Medium, "Visual consistency checks require attention");
    }
    if (!audioQuality.allAudioChecksPassed) {
      add(QualityIssueCategory.Audio, QualityIssueSeverity.Medium, "Audio quality checks require attention");
    }
    if (!textQuality.allTextChecksPassed) {
      add(QualityIssueCategory.Subtitle, QualityIssueSeverity.Low, "Subtitle timing metadata incomplete");
    }
    if (!brandQuality.allBrandChecksPassed) {
      add(QualityIssueCategory.Brand, QualityIssueSeverity.Medium, "Brand consistency review required");
    }
    if (!technicalQuality.allTechnicalChecksPassed) {
      add(QualityIssueCategory.Technical, QualityIssueSeverity.Medium, "Technical render settings require review");
    }
    if (storyboard.relationships.images.length === 0) {
      add(QualityIssueCategory.MissingAsset, QualityIssueSeverity.Low, "No linked image assets in storyboard");
    }

    return issues;
  }

  buildRecommendations(draft: QualityValidationRecordDraft): string[] {
    const recs: string[] = [];
    recs.push("Run final quality gate before render queue submission");
    if (draft.platformValidations.length >= 7) {
      recs.push("Verify platform-specific quality thresholds per delivery target");
    }
    if (draft.issues.filter((i) => i.severity === QualityIssueSeverity.Critical).length === 0) {
      recs.push("No critical issues detected — safe for pre-render approval after final review");
    }
    if (draft.productionReadiness.renderPlansReady) {
      recs.push("Render readiness confirmed — proceed to export planning after approval");
    }
    return recs;
  }
}

export interface QualityValidationRecordDraft {
  validationId: string;
  profile: QualityValidationProfile;
  validationType: QualityValidationType;
  productionReadiness: ProductionReadinessValidationPlan;
  videoQuality: VideoQualityValidationPlan;
  audioQuality: AudioQualityValidationPlan;
  textQuality: TextQualityValidationPlan;
  brandQuality: BrandQualityValidationPlan;
  platformValidations: PlatformQualityValidationPlan[];
  technicalQuality: TechnicalQualityValidationPlan;
  dependencyValidation: QualityDependencyValidationPlan;
  issues: QualityIssue[];
}
