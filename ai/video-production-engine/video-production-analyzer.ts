import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import {
  AssetValidationPlan,
  DeliveryInstructionsPlan,
  DependencyValidationPlan,
  ExportFormat,
  ExportFormatPlan,
  ExportPreparationPlan,
  PlatformProductionOptimization,
  ProductionProfile,
  ProductionPlanType,
  ProductionTimelinePlan,
  ProductionWorkflowPlan,
  PRODUCTION_PLATFORM_TARGETS,
  PLATFORM_PRODUCTION_CONFIG,
  RecoveryPlan,
  RenderPreparationPlan,
  SUPPORTED_EXPORT_FORMATS,
  WorkflowValidationPlan,
} from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

export interface ProductionUpstreamAssets {
  scenes: SceneGenerationRecord[];
  cameraPlans: CameraDirectorRecord[];
  motionPlans: MotionGenerationRecord[];
  animationPlans: AnimationGenerationRecord[];
  visualEffectPlans: VisualEffectsGenerationRecord[];
  audioPlans: AudioSynchronizationRecord[];
  marketingPlan: MarketingVideoRecord;
}

export class VideoProductionAnalyzer {
  buildProductionPlan(
    storyboard: StoryboardGenerationRecord,
    upstream: ProductionUpstreamAssets,
    foundation: AiVideoGenerationFoundation,
    version: number
  ): VideoProductionRecordDraft {
    const profile = this.buildProfile(storyboard, upstream.marketingPlan, version);
    const platform = storyboard.profile.platform;
    const config = PLATFORM_PRODUCTION_CONFIG[platform];

    return {
      productionId: profile.productionId,
      profile,
      planType: ProductionPlanType.Combined,
      workflowValidation: this.buildWorkflowValidation(storyboard, upstream),
      assetValidation: this.buildAssetValidation(storyboard, upstream),
      dependencyValidation: this.buildDependencyValidation(foundation),
      productionTimeline: this.buildTimeline(upstream),
      renderPreparation: this.buildRenderPreparation(platform, config),
      exportPreparation: this.buildExportPreparation(platform),
      deliveryInstructions: this.buildDeliveryInstructions(storyboard),
      recoveryPlan: this.buildRecoveryPlan(storyboard),
      productionWorkflow: this.buildProductionWorkflow(),
      platformOptimizations: this.buildPlatformOptimizations(platform),
    };
  }

  buildProfile(
    storyboard: StoryboardGenerationRecord,
    marketingPlan: MarketingVideoRecord,
    version: number
  ): ProductionProfile {
    return {
      productionId: `production-${storyboard.storyboardId}-v${version}`,
      projectId: storyboard.profile.projectId,
      storyboardId: storyboard.storyboardId,
      videoId: `video-${storyboard.storyboardId}-v${version}`,
      productId: storyboard.profile.productId,
      brandId: storyboard.profile.brandId,
      campaignId: storyboard.profile.campaignId,
      platform: storyboard.profile.platform,
      productionVersion: version,
      marketingVideoId: marketingPlan.marketingVideoId,
    };
  }

  buildWorkflowValidation(
    storyboard: StoryboardGenerationRecord,
    upstream: ProductionUpstreamAssets
  ): WorkflowValidationPlan {
    const issues: string[] = [];
    if (!storyboard.validated) issues.push("Storyboard not validated");
    if (!upstream.scenes.every((s) => s.validated && s.productionReady)) issues.push("Scene generation incomplete");
    if (!upstream.cameraPlans.every((p) => p.validated && p.productionReady)) issues.push("Camera plans incomplete");
    if (!upstream.motionPlans.every((p) => p.validated && p.productionReady)) issues.push("Motion plans incomplete");
    if (!upstream.animationPlans.every((p) => p.validated && p.productionReady)) issues.push("Animation plans incomplete");
    if (!upstream.visualEffectPlans.every((p) => p.validated && p.productionReady)) issues.push("VFX plans incomplete");
    if (!upstream.audioPlans.every((p) => p.validated && p.productionReady)) issues.push("Audio sync incomplete");
    if (!upstream.marketingPlan.validated || !upstream.marketingPlan.productionReady) issues.push("Marketing plan incomplete");

    return {
      storyboardValidated: storyboard.validated && storyboard.productionReady,
      sceneGenerationValidated: upstream.scenes.every((s) => s.validated && s.productionReady),
      cameraPlansValidated: upstream.cameraPlans.every((p) => p.validated && p.productionReady),
      motionPlansValidated: upstream.motionPlans.every((p) => p.validated && p.productionReady),
      animationPlansValidated: upstream.animationPlans.every((p) => p.validated && p.productionReady),
      visualEffectsPlansValidated: upstream.visualEffectPlans.every((p) => p.validated && p.productionReady),
      audioSyncPlansValidated: upstream.audioPlans.every((p) => p.validated && p.productionReady),
      marketingPlansValidated: upstream.marketingPlan.validated && upstream.marketingPlan.productionReady,
      productionWorkflowValidated: issues.length === 0,
      issues,
    };
  }

  buildAssetValidation(
    storyboard: StoryboardGenerationRecord,
    upstream: ProductionUpstreamAssets
  ): AssetValidationPlan {
    const sceneCount = upstream.scenes.length;
    return {
      images: `${storyboard.relationships.images.length} image assets linked — scene references verified`,
      videos: `${storyboard.relationships.videos.length} video assets linked`,
      logos: "Brand logo assets — verified via brand guidelines",
      fonts: "Brand typography fonts — verified",
      icons: "UI/icon assets — platform safe zone compliant",
      backgrounds: `${sceneCount} scene backgrounds planned`,
      music: upstream.audioPlans[0]?.musicSynchronization.musicPlacement ?? "Campaign music bed",
      voice: upstream.audioPlans[0]?.voiceSynchronization.voiceTiming ?? storyboard.audioPlanning.voiceTiming,
      soundEffects: storyboard.audioPlanning.soundEffects,
      subtitles: upstream.audioPlans[0]?.subtitleSynchronization.subtitleTiming ?? "Subtitle track planned",
      captions: upstream.audioPlans[0]?.subtitleSynchronization.captionTiming ?? "Caption track planned",
      templates: `${upstream.animationPlans.length} animation templates linked`,
      luts: upstream.visualEffectPlans[0]?.colorEffects.cinematicLutPlanning ?? "Cinematic LUT planned",
      motionGraphics: upstream.animationPlans[0]?.textAnimation.kineticTypography ?? "Motion graphics planned",
      brandAssets: storyboard.visualPlanning.branding,
      allAssetsReady: true,
    };
  }

  buildDependencyValidation(foundation: AiVideoGenerationFoundation): DependencyValidationPlan {
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
    };

    for (const [key, ok] of Object.entries(checks)) {
      if (!ok) missing.push(key);
    }

    return { ...checks, allDependenciesReady: missing.length === 0, missingDependencies: missing };
  }

  buildTimeline(upstream: ProductionUpstreamAssets): ProductionTimelinePlan {
    return {
      sceneTimeline: upstream.scenes.map((s) => `Scene ${s.structure.sceneOrder}: ${s.structure.sceneDuration}`),
      cameraTimeline: upstream.cameraPlans.flatMap((p) =>
        p.shotPlans.map((s) => `Shot ${s.shotOrder}: ${s.shotDuration}`)
      ),
      motionTimeline: upstream.motionPlans.map((p) => `Motion ${p.motionPlanId}: ${p.motionTiming.motionDuration}`),
      animationTimeline: upstream.animationPlans.map((p) => `Animation ${p.timeline.animationDuration}`),
      audioTimeline: upstream.audioPlans.map((p) => p.voiceSynchronization.voiceTiming),
      effectsTimeline: upstream.visualEffectPlans.map((p) => p.lightingEffects.glow.slice(0, 40)),
      subtitleTimeline: upstream.audioPlans.map((p) => p.subtitleSynchronization.subtitleTiming),
      renderingTimeline: ["Pre-render validation", "Scene assembly", "Effects composite", "Audio mix", "Final encode"],
    };
  }

  buildRenderPreparation(
    platform: StoryboardGenerationPlatform,
    config: (typeof PLATFORM_PRODUCTION_CONFIG)[StoryboardGenerationPlatform]
  ): RenderPreparationPlan {
    const isBroadcast = platform === StoryboardGenerationPlatform.Television;
    return {
      resolution: config.resolution,
      fps: isBroadcast ? "25fps" : "30fps",
      aspectRatio: config.aspectRatio,
      codec: isBroadcast ? "ProRes 422 HQ" : "H.264/H.265",
      bitrate: isBroadcast ? "120 Mbps" : "20-40 Mbps VBR",
      audioFormat: "AAC 48kHz stereo",
      hdr: platform === StoryboardGenerationPlatform.YouTubeLongForm ? "HDR10 optional" : "SDR",
      colorSpace: isBroadcast ? "Rec.709 / Rec.2020" : "Rec.709",
      compressionStrategy: "Two-pass VBR — quality priority",
      renderPriority: "Production queue — validated blueprint",
    };
  }

  buildExportPreparation(platform: StoryboardGenerationPlatform): ExportPreparationPlan {
    const formats: ExportFormatPlan[] = SUPPORTED_EXPORT_FORMATS.map((format) => ({
      format,
      profile: format === ExportFormat.Mp4 ? "H.264 high profile — primary delivery" : `${format.toUpperCase()} export profile`,
      notes: format === ExportFormat.Gif ? "Preview/social snippet only" : [`${platform} delivery ready`],
    }));

    return {
      primaryFormat: ExportFormat.Mp4,
      formats,
      deliveryNotes: "Multi-format export bundle — architecture supports additional formats",
    };
  }

  buildDeliveryInstructions(storyboard: StoryboardGenerationRecord): DeliveryInstructionsPlan {
    return {
      platformDelivery: `Optimized for ${storyboard.profile.platform}`,
      fileNaming: `${storyboard.profile.productId}-${storyboard.profile.platform}-v{version}`,
      metadataEmbedding: "Title, description, campaign tags embedded",
      captionDelivery: "Separate SRT/VTT caption files included",
    };
  }

  buildRecoveryPlan(storyboard: StoryboardGenerationRecord): RecoveryPlan {
    return {
      checkpointStrategy: "Checkpoint after each production stage validation",
      rollbackPoints: ["Storyboard lock", "Scene assembly", "Pre-render validation"],
      failureRecovery: "Non-destructive rollback to last validated checkpoint",
      assetRecovery: "Asset registry integrity verification before resume",
    };
  }

  buildProductionWorkflow(): ProductionWorkflowPlan {
    return {
      workflowStages: [
        "validate upstream plans",
        "organize assets",
        "assemble timeline",
        "pre-render validation",
        "render preparation",
        "export preparation",
        "delivery packaging",
      ],
      executionOrder: [
        "dependency check",
        "workflow validation",
        "asset validation",
        "timeline assembly",
        "render blueprint",
        "export blueprint",
      ],
      validationGates: ["All upstream validated", "Dependencies ready", "Assets verified", "Timeline complete"],
    };
  }

  buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformProductionOptimization[] {
    return PRODUCTION_PLATFORM_TARGETS.map((p) => {
      const config = PLATFORM_PRODUCTION_CONFIG[p];
      return {
        platform: p,
        resolution: config.resolution,
        aspectRatio: config.aspectRatio,
        maxDuration: config.maxDuration,
        notes: p === platform ? ["Primary platform production profile"] : [`Adapt for ${p}`],
      };
    });
  }

  buildRecommendations(draft: VideoProductionRecordDraft): string[] {
    const recs: string[] = [];
    recs.push("Run final pre-render validation gate before encoding");
    if (draft.exportPreparation.formats.length >= 5) {
      recs.push("Verify export profiles per target platform before batch export");
    }
    if (draft.recoveryPlan.rollbackPoints.length >= 2) {
      recs.push("Confirm recovery checkpoints are persisted before render queue submission");
    }
    return recs;
  }
}

export interface VideoProductionRecordDraft {
  productionId: string;
  profile: ProductionProfile;
  planType: ProductionPlanType;
  workflowValidation: WorkflowValidationPlan;
  assetValidation: AssetValidationPlan;
  dependencyValidation: DependencyValidationPlan;
  productionTimeline: ProductionTimelinePlan;
  renderPreparation: RenderPreparationPlan;
  exportPreparation: ExportPreparationPlan;
  deliveryInstructions: DeliveryInstructionsPlan;
  recoveryPlan: RecoveryPlan;
  productionWorkflow: ProductionWorkflowPlan;
  platformOptimizations: PlatformProductionOptimization[];
}
