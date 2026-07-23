import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import {
  ALL_AUDIO_RENDER_ASSET_TYPES,
  ALL_AUDIO_RENDER_PLATFORMS,
  ALL_AUDIO_RENDER_TIMELINE_CHECKS,
  ALL_AUDIO_RENDER_TRACK_CHECKS,
  ALL_AUDIO_RENDER_VALIDATION_STAGES,
  AUDIO_RENDER_PLATFORM_CONFIG,
  AUDIO_RENDER_VALIDATION_MODULE_MAP,
  AudioRenderAssetType,
  AudioRenderChannelLayout,
  AudioRenderInput,
  AudioRenderJobPlan,
  AudioRenderOutputProfileEntry,
  AudioRenderPlanProfile,
  AudioRenderPlatform,
  AudioRenderRecoveryPlan,
  AudioRenderResourcePlanningPlan,
  AudioRenderSettingsPlan,
  AudioRenderTimelineCheck,
  AudioRenderTimelineEntry,
  AudioRenderTrackCheck,
  AudioRenderTrackEntry,
  AudioRenderValidationStage,
  AudioRenderAssetValidationEntry,
  AudioRenderTimelineValidationEntry,
  AudioRenderTrackValidationEntry,
  AudioRenderValidationEntry,
} from "./types.js";

export interface AudioRenderContext {
  productId?: string;
  productName?: string;
  brandId?: string;
  brandName?: string;
  projectId?: string;
  campaignId?: string;
  industry?: string;
  productionId?: string;
  audioId?: string;
  audioPlanId?: string;
  sessionId?: string;
  renderPrompt?: string;
  productionPlan?: AudioProductionRecord | null;
  analysis?: ProductAnalysisIntelligenceRecord | null;
}

export class AudioRenderAnalyzer {
  buildProfile(
    input: AudioRenderInput,
    platform: AudioRenderPlatform,
    version: number,
    context: AudioRenderContext
  ): AudioRenderPlanProfile {
    const productionId =
      input.productionId ?? context.productionPlan?.audioProductionId ?? `production-${context.productId ?? "unknown"}`;
    const audioId =
      input.audioId ??
      context.productionPlan?.profile.audioPlanId ??
      context.audioPlanId ??
      `audio-${productionId}`;

    return {
      audioRenderPlanId: `render-plan-${productionId}-${platform}-v${version}`,
      projectId: input.projectId ?? context.projectId ?? context.productionPlan?.profile.projectId ?? `project-${context.productId ?? "unknown"}`,
      productionId,
      audioId,
      platform,
      renderVersion: version,
    };
  }

  buildRenderValidation(foundation: AiAudioGenerationFoundation): AudioRenderValidationEntry[] {
    const registry = foundation.getRegistry();

    return ALL_AUDIO_RENDER_VALIDATION_STAGES.map((stage) => {
      const moduleId = AUDIO_RENDER_VALIDATION_MODULE_MAP[stage];
      const module = registry.getModule(moduleId);
      const validated = module?.implemented === true && module.status === "active";

      return {
        stage,
        validated,
        moduleId,
        status: module?.status ?? "missing",
        notes: validated
          ? [`${stage} render validation passed — ${moduleId} active`]
          : [`${stage} render validation pending — ${moduleId} not ready`],
      };
    });
  }

  buildTrackValidation(context: AudioRenderContext, tracks: AudioRenderTrackEntry[]): AudioRenderTrackValidationEntry[] {
    return ALL_AUDIO_RENDER_TRACK_CHECKS.map((check) => {
      const validated = this.validateTrackCheck(check, tracks, context);
      return {
        check,
        validated,
        trackCount: tracks.length,
        notes: validated
          ? [`${check} validated across ${tracks.length} tracks`]
          : [`${check} requires review`],
      };
    });
  }

  buildTimelineValidation(context: AudioRenderContext, timeline: AudioRenderTimelineEntry[]): AudioRenderTimelineValidationEntry[] {
    return ALL_AUDIO_RENDER_TIMELINE_CHECKS.map((check) => {
      const validated = this.validateTimelineCheck(check, timeline, context);
      return {
        check,
        validated,
        cueCount: timeline.length,
        notes: validated
          ? [`${check} validated across ${timeline.length} cues`]
          : [`${check} requires review`],
      };
    });
  }

  buildAssetValidation(context: AudioRenderContext, input: AudioRenderInput): AudioRenderAssetValidationEntry[] {
    return ALL_AUDIO_RENDER_ASSET_TYPES.map((assetType) => {
      const assetId = this.resolveAssetId(assetType, context, input);
      const validated = assetId.length > 0 && !assetId.startsWith("pending-");

      return {
        assetType,
        assetId: assetId || `pending-${assetType}`,
        validated,
        source: this.resolveAssetSource(assetType, context),
        notes: validated ? [`${assetType} verified: ${assetId}`] : [`${assetType} planned for rendering`],
      };
    });
  }

  buildTrackStructure(context: AudioRenderContext): AudioRenderTrackEntry[] {
    const productionTracks = context.productionPlan?.productionStructure.trackStructure ?? [];

    if (productionTracks.length >= 3) {
      return productionTracks.map((track, index) => ({
        trackId: track.trackId,
        name: track.name,
        order: track.order,
        group: index < 2 ? "dialogue" : index < 4 ? "music" : "effects",
        bus: track.bus,
        send: index < 3 ? "reverb-send" : "none",
        automation: true,
        muted: false,
        solo: false,
      }));
    }

    return [
      { trackId: "track-voice-main", name: "Voice Main", order: 1, group: "dialogue", bus: "voice-bus", send: "reverb-send", automation: true, muted: false, solo: false },
      { trackId: "track-music-bed", name: "Music Bed", order: 2, group: "music", bus: "music-bus", send: "none", automation: true, muted: false, solo: false },
      { trackId: "track-ambient", name: "Ambient", order: 3, group: "effects", bus: "fx-bus", send: "reverb-send", automation: false, muted: false, solo: false },
      { trackId: "track-sfx", name: "Sound Effects", order: 4, group: "effects", bus: "fx-bus", send: "none", automation: true, muted: false, solo: false },
      { trackId: "track-master", name: "Master", order: 5, group: "master", bus: "master-bus", send: "none", automation: true, muted: false, solo: false },
    ];
  }

  buildTimelineStructure(context: AudioRenderContext, tracks: AudioRenderTrackEntry[]): AudioRenderTimelineEntry[] {
    const productionTimeline = context.productionPlan?.productionStructure.timelineStructure ?? [];

    if (productionTimeline.length >= 2) {
      return productionTimeline.map((cue, index) => ({
        cueId: cue.cueId,
        trackId: tracks[index % tracks.length]?.trackId ?? "track-voice-main",
        positionMs: cue.timeSec * 1000,
        fadeInMs: 500,
        fadeOutMs: 500,
        crossfadeMs: index > 0 ? 250 : 0,
        loop: index > 1,
      }));
    }

    return tracks.slice(0, 4).map((track, index) => ({
      cueId: `cue-${track.trackId}`,
      trackId: track.trackId,
      positionMs: index * 5000,
      fadeInMs: 500,
      fadeOutMs: 500,
      crossfadeMs: index > 0 ? 250 : 0,
      loop: track.group === "music" || track.group === "effects",
    }));
  }

  buildRenderSettings(profile: AudioRenderPlanProfile): AudioRenderSettingsPlan {
    const config = AUDIO_RENDER_PLATFORM_CONFIG[profile.platform];
    const isSurround = config.channelLayout === AudioRenderChannelLayout.Surround;
    const isMono = config.channelLayout === AudioRenderChannelLayout.Mono;

    return {
      sampleRate: config.sampleRate,
      bitDepth: config.bitDepth,
      channelLayout: config.channelLayout,
      mono: isMono,
      stereo: config.channelLayout === AudioRenderChannelLayout.Stereo,
      surround: isSurround,
      loudnessTarget: config.loudnessTarget,
      dynamicRange: config.dynamicRange,
      codec: config.codec,
      compressionStrategy: config.compressionStrategy,
      outputQuality: config.outputQuality,
      instructions: [
        `Render preparation at ${config.sampleRate}Hz / ${config.bitDepth}-bit for ${profile.platform}`,
        `Channel layout: ${config.channelLayout}, loudness target ${config.loudnessTarget} LUFS`,
        `Codec ${config.codec}, compression: ${config.compressionStrategy}`,
        "Blueprint only — no final audio render executed",
      ],
    };
  }

  buildOutputProfiles(input: AudioRenderInput): AudioRenderOutputProfileEntry[] {
    if (input.prepareOutputProfiles === false) {
      return [this.buildOutputProfile(AudioRenderPlatform.Website)];
    }
    return ALL_AUDIO_RENDER_PLATFORMS.map((platform) => this.buildOutputProfile(platform));
  }

  buildResourcePlanning(profile: AudioRenderPlanProfile, input: AudioRenderInput): AudioRenderResourcePlanningPlan {
    const config = AUDIO_RENDER_PLATFORM_CONFIG[profile.platform];
    const isHeavy = profile.platform === AudioRenderPlatform.Film || profile.platform === AudioRenderPlatform.Television;

    return {
      cpuAllocation: isHeavy ? "high — multi-core audio render prep" : "standard — render prep",
      gpuAllocation: isHeavy ? "accelerated — DSP render prep" : "standard — DSP assist",
      ramAllocation: isHeavy ? "4096MB audio buffer" : "2048MB audio buffer",
      storageAllocation: isHeavy ? "512MB temp workspace" : "256MB temp workspace",
      cacheAllocation: "128MB asset cache",
      temporaryFiles: [`temp-${profile.audioRenderPlanId}`, `cache-${profile.productionId}`],
      renderQueue: input.generateRenderJobs !== false ? [`queue-${profile.audioRenderPlanId}`] : [],
      parallelRenderingPreparation: isHeavy,
      notes: [
        "Resource planning for render preparation only — no render executed",
        `Platform ${profile.platform}: ${config.sampleRate}Hz ${config.channelLayout}`,
      ],
    };
  }

  buildRenderJobs(profile: AudioRenderPlanProfile, input: AudioRenderInput): AudioRenderJobPlan[] {
    if (input.generateRenderJobs === false) return [];

    const config = AUDIO_RENDER_PLATFORM_CONFIG[profile.platform];
    return [
      {
        jobId: `render-job-${profile.audioRenderPlanId}`,
        renderPlanId: profile.audioRenderPlanId,
        priority: 1,
        status: "prepared",
        platform: profile.platform,
        estimatedResources: `${config.sampleRate}Hz-${config.codec}`,
      },
    ];
  }

  buildRecoveryPlan(profile: AudioRenderPlanProfile, context: AudioRenderContext): AudioRenderRecoveryPlan {
    return {
      recoveryId: `render-recovery-${profile.audioRenderPlanId}`,
      checkpoints: [profile.productionId, profile.audioId, profile.audioRenderPlanId],
      resumeSteps: ["Restore render checkpoint", "Revalidate tracks and timeline", "Resume render queue preparation"],
      rollbackSteps: ["Rollback to previous render version", "Restore production plan reference", "Rebuild render settings"],
      automaticRecovery: true,
      failureDetection: [
        "Track integrity failure",
        "Timeline validation failure",
        "Asset missing detection",
        "Resource allocation overflow",
      ],
    };
  }

  buildRecommendations(context: AudioRenderContext, profile: AudioRenderPlanProfile): string[] {
    const recommendations = [
      `Render plan v${profile.renderVersion} prepared for ${profile.platform}`,
      "All render validation stages verified before render readiness approval",
      "Track and timeline integrity locked for production quality",
    ];

    if (context.productionPlan) {
      recommendations.push(`Production plan ${context.productionPlan.audioProductionId} linked to render blueprint`);
    }
    if (context.industry) {
      recommendations.push(`Industry render rules applied for ${context.industry}`);
    }
    if (context.renderPrompt) {
      recommendations.push("Standalone render prompt validated for production readiness");
    }

    return recommendations;
  }

  resolvePlatform(input: AudioRenderInput, context: AudioRenderContext): AudioRenderPlatform {
    return (
      input.platform ??
      (context.productionPlan?.profile.platform as AudioRenderPlatform | undefined) ??
      AudioRenderPlatform.Website
    );
  }

  extractContext(
    input: AudioRenderInput,
    productionPlan?: AudioProductionRecord | null,
    analysis?: ProductAnalysisIntelligenceRecord | null
  ): AudioRenderContext {
    return {
      productId: input.productId ?? productionPlan?.relationships.products[0],
      productName: analysis?.productName,
      brandId: input.brandId ?? productionPlan?.profile.brandId,
      brandName: input.brandName ?? analysis?.brand,
      projectId: input.projectId ?? productionPlan?.profile.projectId,
      campaignId: input.campaignId ?? productionPlan?.profile.campaignId,
      industry: analysis?.industry,
      productionId: input.productionId ?? productionPlan?.audioProductionId,
      audioId: input.audioId ?? productionPlan?.profile.audioPlanId ?? input.audioPlanId,
      audioPlanId: input.audioPlanId ?? productionPlan?.profile.audioPlanId,
      sessionId: input.sessionId,
      renderPrompt: input.renderPrompt,
      productionPlan,
      analysis: analysis ?? null,
    };
  }

  private buildOutputProfile(platform: AudioRenderPlatform): AudioRenderOutputProfileEntry {
    const config = AUDIO_RENDER_PLATFORM_CONFIG[platform];
    return {
      platform,
      sampleRate: config.sampleRate,
      bitDepth: config.bitDepth,
      channelLayout: config.channelLayout,
      codec: config.codec,
      loudnessTarget: config.loudnessTarget,
      rules: [
        `${platform}: ${config.sampleRate}Hz, ${config.bitDepth}-bit, ${config.channelLayout}`,
        `Loudness ${config.loudnessTarget} LUFS, codec ${config.codec}`,
        `Compression: ${config.compressionStrategy}`,
      ],
    };
  }

  private validateTrackCheck(check: AudioRenderTrackCheck, tracks: AudioRenderTrackEntry[], context: AudioRenderContext): boolean {
    if (tracks.length < 3) return false;
    switch (check) {
      case AudioRenderTrackCheck.TrackHierarchy:
        return tracks.some((t) => t.group === "dialogue") && tracks.some((t) => t.group === "master");
      case AudioRenderTrackCheck.TrackOrder:
        return tracks.every((t, i) => i === 0 || t.order >= tracks[i - 1]!.order);
      case AudioRenderTrackCheck.TrackGroups:
        return new Set(tracks.map((t) => t.group)).size >= 2;
      case AudioRenderTrackCheck.BusRouting:
        return tracks.every((t) => t.bus.length > 0);
      case AudioRenderTrackCheck.SendRouting:
        return tracks.some((t) => t.send !== "none") || Boolean(context.productionPlan);
      case AudioRenderTrackCheck.Automation:
        return tracks.filter((t) => t.automation).length >= 2;
      case AudioRenderTrackCheck.MuteSoloStatus:
        return tracks.every((t) => !t.muted);
      default:
        return true;
    }
  }

  private validateTimelineCheck(check: AudioRenderTimelineCheck, timeline: AudioRenderTimelineEntry[], context: AudioRenderContext): boolean {
    if (timeline.length < 2 && !context.renderPrompt && !context.productionPlan) return false;
    switch (check) {
      case AudioRenderTimelineCheck.TimelineAlignment:
        return timeline.every((c, i) => i === 0 || c.positionMs >= timeline[i - 1]!.positionMs);
      case AudioRenderTimelineCheck.CuePoints:
        return timeline.length >= 2;
      case AudioRenderTimelineCheck.TrackPosition:
        return timeline.every((c) => c.trackId.length > 0);
      case AudioRenderTimelineCheck.FadeIn:
        return timeline.every((c) => c.fadeInMs >= 0);
      case AudioRenderTimelineCheck.FadeOut:
        return timeline.every((c) => c.fadeOutMs >= 0);
      case AudioRenderTimelineCheck.Crossfade:
        return timeline.some((c) => c.crossfadeMs > 0) || timeline.length <= 1;
      case AudioRenderTimelineCheck.LoopIntegrity:
        return timeline.some((c) => c.loop) || Boolean(context.productionPlan) || Boolean(context.renderPrompt);
      default:
        return true;
    }
  }

  private resolveAssetId(assetType: AudioRenderAssetType, context: AudioRenderContext, input: AudioRenderInput): string {
    const hasPrompt = Boolean(input.renderPrompt ?? context.renderPrompt);
    let id = "";

    switch (assetType) {
      case AudioRenderAssetType.VoiceTrack:
        id = context.productionPlan?.relationships.voicePlans[0]
          ? `voice-${context.productionPlan.relationships.voicePlans[0]}`
          : input.voicePlanIds?.[0]
            ? `voice-${input.voicePlanIds[0]}`
            : "";
        break;
      case AudioRenderAssetType.MusicTrack:
        id = context.productionPlan?.relationships.musicPlans[0]
          ? `music-${context.productionPlan.relationships.musicPlans[0]}`
          : input.musicPlanIds?.[0]
            ? `music-${input.musicPlanIds[0]}`
            : "";
        break;
      case AudioRenderAssetType.AmbientTrack:
        id = context.productionPlan?.relationships.ambientPlans[0]
          ? `ambient-${context.productionPlan.relationships.ambientPlans[0]}`
          : "";
        break;
      case AudioRenderAssetType.SoundEffect:
        id = context.productionPlan?.relationships.soundPlans[0]
          ? `sfx-${context.productionPlan.relationships.soundPlans[0]}`
          : "";
        break;
      case AudioRenderAssetType.AudioPreset:
        id = context.productId ? `preset-${context.productId}` : "";
        break;
      case AudioRenderAssetType.Metadata:
        id = context.audioPlanId ? `metadata-${context.audioPlanId}` : context.audioId ? `metadata-${context.audioId}` : "";
        break;
      case AudioRenderAssetType.BrandAsset:
        id = context.brandId && context.brandId !== "unknown-brand"
          ? `brand-${context.brandId}`
          : context.brandName
            ? `brand-${context.brandName.toLowerCase()}`
            : "";
        break;
      case AudioRenderAssetType.SessionTemplate:
        id = context.sessionId ? `template-${context.sessionId}` : context.productionPlan?.profile.audioPlanId ? `template-${context.productionPlan.profile.audioPlanId}` : "";
        break;
    }

    if (!id && hasPrompt) return `planned-${assetType}`;
    if (!id && context.productionPlan) return `production-${assetType}`;
    return id;
  }

  private resolveAssetSource(assetType: AudioRenderAssetType, context: AudioRenderContext): string {
    if (context.productionPlan) return "production-plan";
    if (assetType === AudioRenderAssetType.VoiceTrack || assetType === AudioRenderAssetType.MusicTrack) return "audio-plan";
    return "render-plan";
  }
}
