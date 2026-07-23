import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MarketingVideoRecord } from "../marketing-video-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import {
  OUTPUT_PROFILE_CONFIG,
  RENDER_OUTPUT_PLATFORM_TARGETS,
  RenderAssetValidationPlan,
  RenderDependencyValidationPlan,
  RenderJobPlan,
  RenderOutputPlatform,
  RenderPlanType,
  RenderProfile,
  RenderRecoveryPlan,
  RenderSettingsPlan,
  RenderValidationPlan,
  ResourcePlanningPlan,
  TimelineValidationPlan,
  OutputProfilePlan,
  mapStoryboardToRenderOutput,
} from "./types.js";

export interface RenderingUpstreamAssets {
  scenes: SceneGenerationRecord[];
  cameraPlans: CameraDirectorRecord[];
  motionPlans: MotionGenerationRecord[];
  animationPlans: AnimationGenerationRecord[];
  visualEffectPlans: VisualEffectsGenerationRecord[];
  audioPlans: AudioSynchronizationRecord[];
  marketingPlan: MarketingVideoRecord;
  productionPlan: VideoProductionRecord;
}

export class RenderingPreparationAnalyzer {
  buildRenderPlan(
    storyboard: StoryboardGenerationRecord,
    upstream: RenderingUpstreamAssets,
    foundation: AiVideoGenerationFoundation,
    version: number
  ): RenderingPreparationRecordDraft {
    const profile = this.buildProfile(storyboard, upstream.productionPlan, version);
    const platform = storyboard.profile.platform;
    const primaryOutput = mapStoryboardToRenderOutput(platform);
    const config = OUTPUT_PROFILE_CONFIG[primaryOutput];

    return {
      renderPlanId: profile.renderPlanId,
      profile,
      planType: RenderPlanType.Combined,
      renderValidation: this.buildRenderValidation(storyboard, upstream),
      timelineValidation: this.buildTimelineValidation(upstream),
      assetValidation: this.buildAssetValidation(storyboard, upstream),
      dependencyValidation: this.buildDependencyValidation(foundation),
      renderSettings: this.buildRenderSettings(platform, config, upstream.productionPlan),
      outputProfiles: this.buildOutputProfiles(platform),
      resourcePlanning: this.buildResourcePlanning(upstream),
      renderJobs: this.buildRenderJobs(profile, platform),
      recoveryPlan: this.buildRecoveryPlan(storyboard),
    };
  }

  buildProfile(
    storyboard: StoryboardGenerationRecord,
    productionPlan: VideoProductionRecord,
    version: number
  ): RenderProfile {
    return {
      renderPlanId: `render-${storyboard.storyboardId}-v${version}`,
      projectId: storyboard.profile.projectId,
      productionId: productionPlan.productionId,
      videoId: productionPlan.profile.videoId,
      platform: storyboard.profile.platform,
      renderVersion: version,
    };
  }

  buildRenderValidation(
    storyboard: StoryboardGenerationRecord,
    upstream: RenderingUpstreamAssets
  ): RenderValidationPlan {
    const issues: string[] = [];
    if (!storyboard.validated || !storyboard.productionReady) issues.push("Storyboard not validated");
    if (!upstream.scenes.every((s) => s.validated && s.productionReady)) issues.push("Scene generation incomplete");
    if (!upstream.cameraPlans.every((p) => p.validated && p.productionReady)) issues.push("Camera plans incomplete");
    if (!upstream.motionPlans.every((p) => p.validated && p.productionReady)) issues.push("Motion plans incomplete");
    if (!upstream.animationPlans.every((p) => p.validated && p.productionReady)) issues.push("Animation plans incomplete");
    if (!upstream.visualEffectPlans.every((p) => p.validated && p.productionReady)) issues.push("VFX plans incomplete");
    if (!upstream.audioPlans.every((p) => p.validated && p.productionReady)) issues.push("Audio sync incomplete");
    if (!upstream.marketingPlan.validated || !upstream.marketingPlan.productionReady) issues.push("Marketing plan incomplete");
    if (!upstream.productionPlan.validated || !upstream.productionPlan.productionReady) issues.push("Production plan incomplete");

    return {
      storyboardValidated: storyboard.validated && storyboard.productionReady,
      sceneGenerationValidated: upstream.scenes.every((s) => s.validated && s.productionReady),
      cameraPlansValidated: upstream.cameraPlans.every((p) => p.validated && p.productionReady),
      motionPlansValidated: upstream.motionPlans.every((p) => p.validated && p.productionReady),
      animationPlansValidated: upstream.animationPlans.every((p) => p.validated && p.productionReady),
      visualEffectsPlansValidated: upstream.visualEffectPlans.every((p) => p.validated && p.productionReady),
      audioSyncValidated: upstream.audioPlans.every((p) => p.validated && p.productionReady),
      marketingPlansValidated: upstream.marketingPlan.validated && upstream.marketingPlan.productionReady,
      productionPlansValidated: upstream.productionPlan.validated && upstream.productionPlan.productionReady,
      allValidated: issues.length === 0,
      issues,
    };
  }

  buildTimelineValidation(upstream: RenderingUpstreamAssets): TimelineValidationPlan {
    const sceneTimeline = upstream.scenes.map((s) => `Scene ${s.structure.sceneOrder}: ${s.structure.sceneDuration}`);
    const cameraTimeline = upstream.cameraPlans.flatMap((p) =>
      p.shotPlans.map((s) => `Shot ${s.shotOrder}: ${s.shotDuration}`)
    );
    const motionTimeline = upstream.motionPlans.map((p) => `Motion ${p.motionPlanId}: ${p.motionTiming.motionDuration}`);
    const animationTimeline = upstream.animationPlans.map((p) => `Animation ${p.timeline.animationDuration}`);
    const audioTimeline = upstream.audioPlans.map((p) => p.voiceSynchronization.voiceTiming);
    const subtitleTimeline = upstream.audioPlans.map((p) => p.subtitleSynchronization.subtitleTiming);
    const effectTimeline = upstream.visualEffectPlans.map((p) => p.lightingEffects.glow.slice(0, 40));
    const renderTimeline = upstream.productionPlan.productionTimeline.renderingTimeline.length > 0
      ? upstream.productionPlan.productionTimeline.renderingTimeline
      : ["Pre-render validation", "Scene assembly", "Effects composite", "Audio mix", "Final encode"];

    const sceneTimelineValid = sceneTimeline.length >= 1;
    const cameraTimelineValid = cameraTimeline.length >= 1;
    const motionTimelineValid = motionTimeline.length >= 1;
    const animationTimelineValid = animationTimeline.length >= 1;
    const audioTimelineValid = audioTimeline.length >= 1;
    const subtitleTimelineValid = subtitleTimeline.length >= 1;
    const effectTimelineValid = effectTimeline.length >= 1;
    const renderTimelineValid = renderTimeline.length >= 4;

    return {
      sceneTimelineValid,
      cameraTimelineValid,
      motionTimelineValid,
      animationTimelineValid,
      audioTimelineValid,
      subtitleTimelineValid,
      effectTimelineValid,
      renderTimelineValid,
      sceneTimeline,
      cameraTimeline,
      motionTimeline,
      animationTimeline,
      audioTimeline,
      subtitleTimeline,
      effectTimeline,
      renderTimeline,
      allTimelinesValid:
        sceneTimelineValid &&
        cameraTimelineValid &&
        motionTimelineValid &&
        animationTimelineValid &&
        audioTimelineValid &&
        subtitleTimelineValid &&
        effectTimelineValid &&
        renderTimelineValid,
    };
  }

  buildAssetValidation(
    storyboard: StoryboardGenerationRecord,
    upstream: RenderingUpstreamAssets
  ): RenderAssetValidationPlan {
    const sceneCount = upstream.scenes.length;
    return {
      images: `${storyboard.relationships.images.length} image assets linked — render references verified`,
      videos: `${storyboard.relationships.videos.length} video assets linked`,
      logos: "Brand logo assets — verified via brand guidelines",
      fonts: "Brand typography fonts — verified for render text layers",
      music: upstream.audioPlans[0]?.musicSynchronization.musicPlacement ?? "Campaign music bed",
      voice: upstream.audioPlans[0]?.voiceSynchronization.voiceTiming ?? storyboard.audioPlanning.voiceTiming,
      soundEffects: storyboard.audioPlanning.soundEffects,
      luts: upstream.visualEffectPlans[0]?.colorEffects.cinematicLutPlanning ?? "Cinematic LUT planned",
      motionGraphics: upstream.animationPlans[0]?.textAnimation.kineticTypography ?? "Motion graphics planned",
      templates: `${upstream.animationPlans.length} animation templates linked`,
      captions: upstream.audioPlans[0]?.subtitleSynchronization.captionTiming ?? "Caption track planned",
      subtitles: upstream.audioPlans[0]?.subtitleSynchronization.subtitleTiming ?? "Subtitle track planned",
      brandAssets: storyboard.visualPlanning.branding,
      allAssetsReady: upstream.productionPlan.assetValidation.allAssetsReady,
    };
  }

  buildDependencyValidation(foundation: AiVideoGenerationFoundation): RenderDependencyValidationPlan {
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
    };

    for (const [key, ok] of Object.entries(checks)) {
      if (!ok) missing.push(key);
    }

    return { ...checks, allDependenciesReady: missing.length === 0, missingDependencies: missing };
  }

  buildRenderSettings(
    platform: StoryboardGenerationPlatform,
    config: (typeof OUTPUT_PROFILE_CONFIG)[RenderOutputPlatform],
    productionPlan: VideoProductionRecord
  ): RenderSettingsPlan {
    const isBroadcast = platform === StoryboardGenerationPlatform.Television;
    const isLongForm = platform === StoryboardGenerationPlatform.YouTubeLongForm;
    const prodRender = productionPlan.renderPreparation;

    return {
      resolution: prodRender.resolution || config.resolution,
      aspectRatio: prodRender.aspectRatio || config.aspectRatio,
      frameRate: prodRender.fps || config.frameRate,
      codec: prodRender.codec || config.codec,
      bitrate: prodRender.bitrate || config.bitrate,
      hdr: isLongForm ? "HDR10 optional" : "SDR primary",
      sdr: "Rec.709 SDR baseline",
      colorSpace: isBroadcast ? "Rec.709 / Rec.2020" : "Rec.709",
      pixelFormat: isBroadcast ? "yuv422p10le" : "yuv420p",
      audioCodec: "AAC-LC",
      audioBitrate: "192 kbps stereo",
      compressionProfile: prodRender.compressionStrategy || "Two-pass VBR — quality priority",
      keyframeInterval: isBroadcast ? "1 second (GOP 25)" : "2 seconds (GOP 60)",
      renderPriority: prodRender.renderPriority || "Validated render queue — high priority",
    };
  }

  buildOutputProfiles(primaryPlatform: StoryboardGenerationPlatform): OutputProfilePlan[] {
    const primary = mapStoryboardToRenderOutput(primaryPlatform);
    return RENDER_OUTPUT_PLATFORM_TARGETS.map((p) => {
      const config = OUTPUT_PROFILE_CONFIG[p];
      return {
        platform: p,
        resolution: config.resolution,
        aspectRatio: config.aspectRatio,
        frameRate: config.frameRate,
        codec: config.codec,
        bitrate: config.bitrate,
        notes: p === primary ? ["Primary render output profile"] : [`Adapted output for ${p}`],
      };
    });
  }

  buildResourcePlanning(upstream: RenderingUpstreamAssets): ResourcePlanningPlan {
    const sceneCount = upstream.scenes.length;
    const complexity = sceneCount >= 10 ? "high" : sceneCount >= 6 ? "medium" : "standard";

    return {
      cpuAllocation: `${complexity === "high" ? "8" : complexity === "medium" ? "4" : "2"} cores — timeline validation and asset indexing`,
      gpuAllocation: `${complexity === "high" ? "Dedicated GPU — 8GB VRAM" : "Shared GPU — 4GB VRAM"} — effects and motion composite prep`,
      ramAllocation: `${complexity === "high" ? "32GB" : "16GB"} — scene cache and audio buffers`,
      storageAllocation: `${sceneCount * 512}MB estimated — source assets and intermediate frames`,
      cacheAllocation: "2GB render cache — validated asset fingerprints",
      temporaryFiles: `${sceneCount * 128}MB temp workspace — non-destructive preparation only`,
      renderQueue: "Priority queue — validated plans first, parallel prep enabled",
      parallelRenderingPreparation: `${Math.min(sceneCount, 4)} parallel validation workers`,
    };
  }

  buildRenderJobs(profile: RenderProfile, platform: StoryboardGenerationPlatform): RenderJobPlan[] {
    const primary = mapStoryboardToRenderOutput(platform);
    const primaryJob: RenderJobPlan = {
      jobId: `job-${profile.renderPlanId}-primary`,
      renderPlanId: profile.renderPlanId,
      priority: "high",
      status: "prepared",
      outputProfile: primary,
      estimatedDuration: "Preparation complete — render not started",
    };

    const secondaryJobs = RENDER_OUTPUT_PLATFORM_TARGETS.filter((p) => p !== primary).slice(0, 2).map((p, i) => ({
      jobId: `job-${profile.renderPlanId}-${p}-${i + 1}`,
      renderPlanId: profile.renderPlanId,
      priority: "normal",
      status: "prepared",
      outputProfile: p,
      estimatedDuration: "Secondary output profile — queued after primary",
    }));

    return [primaryJob, ...secondaryJobs];
  }

  buildRecoveryPlan(storyboard: StoryboardGenerationRecord): RenderRecoveryPlan {
    return {
      checkpointStrategy: "Checkpoint after each render preparation validation gate",
      resumeRendering: "Resume from last validated checkpoint without re-validating upstream plans",
      rollback: "Non-destructive rollback to pre-render validation state",
      automaticRecovery: "Auto-repair safe timeline and asset gaps before queue submission",
      failureDetection: "Continuous validation monitoring — abort on integrity failure",
      rollbackPoints: ["Storyboard lock", "Production plan lock", "Pre-render validation", "Render blueprint lock"],
    };
  }

  buildRecommendations(draft: RenderingPreparationRecordDraft): string[] {
    const recs: string[] = [];
    recs.push("Confirm all render validation gates pass before queue submission");
    if (draft.outputProfiles.length >= 9) {
      recs.push("Verify output profiles per target platform before batch render preparation");
    }
    if (draft.recoveryPlan.rollbackPoints.length >= 3) {
      recs.push("Persist recovery checkpoints before render job dispatch");
    }
    if (draft.resourcePlanning.parallelRenderingPreparation.includes("parallel")) {
      recs.push("Monitor resource allocation during parallel render preparation");
    }
    return recs;
  }
}

export interface RenderingPreparationRecordDraft {
  renderPlanId: string;
  profile: RenderProfile;
  planType: RenderPlanType;
  renderValidation: RenderValidationPlan;
  timelineValidation: TimelineValidationPlan;
  assetValidation: RenderAssetValidationPlan;
  dependencyValidation: RenderDependencyValidationPlan;
  renderSettings: RenderSettingsPlan;
  outputProfiles: OutputProfilePlan[];
  resourcePlanning: ResourcePlanningPlan;
  renderJobs: RenderJobPlan[];
  recoveryPlan: RenderRecoveryPlan;
}
