import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  ALL_AUDIO_PRODUCTION_ASSET_TYPES,
  ALL_AUDIO_PRODUCTION_DEPENDENCIES,
  ALL_AUDIO_PRODUCTION_EXPORT_FORMATS,
  ALL_AUDIO_PRODUCTION_WORKFLOW_STAGES,
  AssetValidationEntry,
  AudioProductionAssetType,
  AudioProductionDependency,
  AudioProductionExportFormat,
  AudioProductionInput,
  AudioProductionPlatform,
  AudioProductionProfile,
  AudioProductionWorkflowStage,
  AUDIO_PRODUCTION_PLATFORM_CONFIG,
  DeliveryInstructions,
  DependencyValidationEntry,
  DEPENDENCY_MODULE_MAP,
  ExportPreparationEntry,
  ExportPreparationPlan,
  PlatformProductionRules,
  ProductionBusEntry,
  ProductionStructure,
  ProductionTrackEntry,
  RecoveryPlan,
  RenderPreparationPlan,
  TrackValidationEntry,
  WorkflowValidationEntry,
  WORKFLOW_MODULE_MAP,
} from "./types.js";

export interface AudioProductionContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  projectId?: string;
  campaignId?: string;
  industry?: string;
  audioPlanId?: string;
  mixingPlanId?: string;
  masteringPlanId?: string;
  productionPrompt?: string;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

export class AudioProductionAnalyzer {
  buildProfile(
    input: AudioProductionInput,
    platform: AudioProductionPlatform,
    version: number,
    context: AudioProductionContext
  ): AudioProductionProfile {
    const productId = context.productId ?? input.productId ?? "standalone";
    const brandId = input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand";
    const audioPlanId =
      input.audioPlanId ?? input.mixingPlanId ?? context.mixingPlanId ?? `audio-plan-${productId}`;

    return {
      audioProductionId: `audio-production-${audioPlanId}-${platform}-v${version}`,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      audioPlanId,
      brandId,
      campaignId: input.campaignId ?? context.campaignId ?? `campaign-${productId}`,
      platform,
      productionVersion: version,
    };
  }

  resolveAudioPlanId(input: AudioProductionInput, context: AudioProductionContext): string | null {
    return input.audioPlanId ?? input.mixingPlanId ?? context.mixingPlanId ?? context.audioPlanId ?? null;
  }

  buildWorkflowValidation(foundation: AiAudioGenerationFoundation): WorkflowValidationEntry[] {
    const registry = foundation.getRegistry();

    return ALL_AUDIO_PRODUCTION_WORKFLOW_STAGES.map((stage) => {
      const moduleId = WORKFLOW_MODULE_MAP[stage];
      let validated = false;
      let status = "missing";

      if (stage === AudioProductionWorkflowStage.ProductionWorkflow) {
        validated = foundation.isStartupComplete();
        status = validated ? "active" : "initializing";
      } else {
        const module = registry.getModule(moduleId);
        validated = module?.implemented === true && module.status === "active";
        status = module?.status ?? "missing";
      }

      return {
        stage,
        validated,
        moduleId,
        status,
        notes: validated
          ? [`${stage} workflow validated — ${moduleId} active`]
          : [`${stage} workflow pending — ${moduleId} not ready`],
      };
    });
  }

  buildAssetValidation(context: AudioProductionContext, input: AudioProductionInput): AssetValidationEntry[] {
    return ALL_AUDIO_PRODUCTION_ASSET_TYPES.map((assetType) => {
      const assetId = this.resolveAssetId(assetType, context, input);
      const validated = assetId.length > 0 && !assetId.startsWith("pending-");

      return {
        assetType,
        assetId: assetId || `pending-${assetType}`,
        validated,
        source: this.resolveAssetSource(assetType, context, input),
        notes: validated
          ? [`${assetType} asset verified: ${assetId}`]
          : [`${assetType} asset planned for production`],
      };
    });
  }

  buildTrackValidation(structure: ProductionStructure): TrackValidationEntry[] {
    return structure.trackStructure.map((track) => ({
      trackId: track.trackId,
      trackType: track.type,
      validated: track.validated,
      notes: track.validated ? [`Track ${track.name} validated on ${track.bus}`] : [`Track ${track.name} pending`],
    }));
  }

  buildDependencyValidation(foundation: AiAudioGenerationFoundation): DependencyValidationEntry[] {
    const integration = foundation.integration;
    const registry = foundation.getRegistry();
    const status = integration.getStatus();

    return ALL_AUDIO_PRODUCTION_DEPENDENCIES.map((dependency) => {
      let available = false;
      let moduleId: string | undefined;
      const notes: string[] = [];

      switch (dependency) {
        case AudioProductionDependency.MemoryEngine:
          available = status.memoryEngine;
          notes.push(available ? "Memory Engine connected" : "Memory Engine unavailable");
          break;
        case AudioProductionDependency.KnowledgeEngine:
          available = status.knowledgeEngine;
          notes.push(available ? "Knowledge Engine connected" : "Knowledge Engine unavailable");
          break;
        case AudioProductionDependency.ProductIntelligenceEngine:
          available = status.productIntelligenceEngine;
          notes.push(available ? "Product Intelligence Engine connected" : "Product Intelligence unavailable");
          break;
        case AudioProductionDependency.ImageIntelligenceEngine:
          available = status.imageIntelligenceEngine;
          notes.push(available ? "Image Intelligence Engine connected" : "Image Intelligence unavailable");
          break;
        case AudioProductionDependency.VideoIntelligenceEngine:
          available = status.videoIntelligenceEngine;
          notes.push(available ? "Video Intelligence Engine connected" : "Video Intelligence unavailable");
          break;
        case AudioProductionDependency.VideoGenerationEngine:
          available = status.videoGenerationEngine;
          notes.push(available ? "Video Generation Engine connected" : "Video Generation unavailable");
          break;
        case AudioProductionDependency.ImageGenerationEngine:
          available = status.imageGenerationEngine;
          notes.push(available ? "Image Generation Engine connected" : "Image Generation unavailable");
          break;
        case AudioProductionDependency.AudioGenerationFoundation:
          available = foundation.isStartupComplete();
          notes.push(available ? "Audio Generation Foundation operational" : "Foundation not ready");
          break;
        default: {
          moduleId = DEPENDENCY_MODULE_MAP[dependency];
          if (moduleId) {
            const module = registry.getModule(moduleId);
            available = module?.implemented === true && module.status === "active";
            notes.push(available ? `${moduleId} registered and active` : `${moduleId} not implemented`);
          }
          break;
        }
      }

      return { dependency, available, moduleId, notes };
    });
  }

  buildProductionStructure(profile: AudioProductionProfile, context: AudioProductionContext): ProductionStructure {
    const tracks: ProductionTrackEntry[] = [
      { trackId: "track-voice", name: "Voice", order: 1, type: "voice", bus: "voice-bus", validated: true },
      { trackId: "track-music", name: "Music", order: 2, type: "music", bus: "music-bus", validated: true },
      { trackId: "track-ambient", name: "Ambient", order: 3, type: "ambient", bus: "ambient-bus", validated: true },
      { trackId: "track-sfx", name: "Sound Effects", order: 4, type: "effects", bus: "fx-bus", validated: true },
      { trackId: "track-master", name: "Master", order: 5, type: "master", bus: "master-bus", validated: true },
    ];

    const buses: ProductionBusEntry[] = [
      { busId: "voice-bus", name: "Voice Bus", order: 1, type: "voice" },
      { busId: "music-bus", name: "Music Bus", order: 2, type: "music" },
      { busId: "ambient-bus", name: "Ambient Bus", order: 3, type: "ambient" },
      { busId: "fx-bus", name: "FX Bus", order: 4, type: "effects" },
      { busId: "master-bus", name: "Master Bus", order: 5, type: "master" },
    ];

    return {
      trackStructure: tracks,
      busStructure: buses,
      timelineStructure: [
        { cueId: "cue-intro", timeSec: 0, label: "Intro" },
        { cueId: "cue-body", timeSec: 30, label: "Body" },
        { cueId: "cue-outro", timeSec: 90, label: "Outro" },
      ],
      assetHierarchy: ["voice", "music", "ambient", "effects", "templates", "metadata", "presets"],
      metadataStructure: {
        productId: context.productId ?? profile.audioPlanId,
        brandId: profile.brandId,
        campaignId: profile.campaignId,
        platform: profile.platform,
        productionVersion: String(profile.productionVersion),
      },
      versionStructure: {
        currentVersion: profile.productionVersion,
        historyRef: `production-history-${profile.audioProductionId}`,
      },
    };
  }

  buildRenderPreparation(profile: AudioProductionProfile): RenderPreparationPlan {
    const config = AUDIO_PRODUCTION_PLATFORM_CONFIG[profile.platform];
    return {
      sampleRate: config.sampleRate,
      bitDepth: 24,
      channelLayout: config.channelLayout,
      loudnessTarget: `${config.targetLufs} LUFS integrated`,
      dynamicRange: profile.platform === AudioProductionPlatform.Film ? "cinema dynamic range" : "streaming dynamic range",
      codecPreparation: "Lossless intermediate + delivery codec chain",
      outputQuality: "Production-ready blueprint — no final render",
      instructions: [
        `Sample rate: ${config.sampleRate}Hz`,
        `Channels: ${config.channelLayout}`,
        `Loudness: ${config.targetLufs} LUFS`,
        "Validate all tracks before render execution",
      ],
    };
  }

  buildExportPreparation(input: AudioProductionInput): ExportPreparationPlan {
    const exports: ExportPreparationEntry[] = ALL_AUDIO_PRODUCTION_EXPORT_FORMATS.map((format) => ({
      format,
      enabled: input.prepareExports !== false,
      bitrate: format === AudioProductionExportFormat.Flac || format === AudioProductionExportFormat.Wav ? "lossless" : "320kbps",
      notes: [`${format.toUpperCase()} export prepared`],
    }));

    return {
      exports,
      extensibleFormats: ["m4a", "opus", "alac"],
    };
  }

  buildDeliveryInstructions(profile: AudioProductionProfile): DeliveryInstructions {
    return {
      platform: profile.platform,
      deliveryTargets: [profile.platform, "asset-registry", "blueprint-manager"],
      packagingNotes: ["Non-destructive production workflow", "Versioned production blueprint"],
      distributionNotes: [`Platform rules for ${profile.platform}`, "Brand-consistent delivery"],
    };
  }

  buildRecoveryPlan(profile: AudioProductionProfile, context: AudioProductionContext): RecoveryPlan {
    return {
      recoveryId: `recovery-${profile.audioProductionId}`,
      checkpoints: ["pre-validation", "post-workflow", "post-asset", "pre-blueprint"],
      rollbackSteps: ["Restore previous production version", "Re-validate workflows", "Re-link assets"],
      assetRecoveryRefs: [
        profile.audioPlanId,
        context.mixingPlanId ?? profile.audioPlanId,
        profile.audioProductionId,
      ],
    };
  }

  buildPlatformRules(input: AudioProductionInput, profile: AudioProductionProfile): PlatformProductionRules {
    const config = AUDIO_PRODUCTION_PLATFORM_CONFIG[profile.platform];
    return {
      platform: profile.platform,
      loudnessTarget: `${config.targetLufs} LUFS`,
      exportFormats: input.preparePlatformRules !== false ? ALL_AUDIO_PRODUCTION_EXPORT_FORMATS.slice(0, 4) : [AudioProductionExportFormat.Wav],
      rules: [
        `Loudness target: ${config.targetLufs} LUFS`,
        `Channel layout: ${config.channelLayout}`,
        "All workflow stages must pass before approval",
      ],
    };
  }

  buildRecommendations(context: AudioProductionContext, profile: AudioProductionProfile): string[] {
    const recs: string[] = [];
    if (context.mixingPlanId) recs.push("Link mixing plan to production execution blueprint");
    if (profile.platform === AudioProductionPlatform.Film) recs.push("Prepare surround and Atmos deliverables");
    if (context.brandName) recs.push(`Align production with ${context.brandName} brand guidelines`);
    recs.push("Validate all upstream audio plans before render execution");
    return recs;
  }

  resolvePlatform(input: AudioProductionInput, context: AudioProductionContext): AudioProductionPlatform {
    if (input.platform) return input.platform;
    if (context.creative?.profile.platform === "youtube") return AudioProductionPlatform.YouTube;
    if (context.creative?.profile.platform === "tiktok") return AudioProductionPlatform.TikTok;
    if (context.industry === "health") return AudioProductionPlatform.Podcast;
    return AudioProductionPlatform.Website;
  }

  extractContextFromInput(input: AudioProductionInput): AudioProductionContext {
    return {
      productId: input.productId,
      brandName: input.brandName,
      brandId: input.brandId,
      campaignId: input.campaignId,
      audioPlanId: input.audioPlanId,
      mixingPlanId: input.mixingPlanId,
      masteringPlanId: input.masteringPlanId,
      productionPrompt: input.productionPrompt,
    };
  }

  extractContextFromProduct(
    productId: string,
    productName: string,
    brandName: string,
    understanding?: ProductUnderstandingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    input?: AudioProductionInput
  ): AudioProductionContext {
    return {
      productId,
      productName,
      brandName,
      brandId: input?.brandId ?? brandName,
      projectId: input?.projectId ?? `project-${productId}`,
      campaignId: input?.campaignId ?? strategy?.strategyId,
      industry: understanding?.customer?.targetIndustry,
      audioPlanId: input?.audioPlanId,
      mixingPlanId: input?.mixingPlanId,
      masteringPlanId: input?.masteringPlanId,
      creative,
      strategy,
      understanding,
    };
  }

  private resolveAssetId(
    assetType: AudioProductionAssetType,
    context: AudioProductionContext,
    input: AudioProductionInput
  ): string {
    const hasPrompt = Boolean(input.productionPrompt ?? context.productionPrompt);

    let id = "";
    switch (assetType) {
      case AudioProductionAssetType.VoiceTrack:
        id = input.voiceTrackRefs?.[0] ?? (input.voicePlanIds?.[0] ? `voice-${input.voicePlanIds[0]}` : "");
        break;
      case AudioProductionAssetType.MusicTrack:
        id = input.musicTrackRefs?.[0] ?? (input.musicPlanIds?.[0] ? `music-${input.musicPlanIds[0]}` : "");
        break;
      case AudioProductionAssetType.SoundEffect:
        id = input.soundPlanIds?.[0] ? `sfx-${input.soundPlanIds[0]}` : "";
        break;
      case AudioProductionAssetType.AmbientTrack:
        id = input.ambientPlanIds?.[0] ? `ambient-${input.ambientPlanIds[0]}` : "";
        break;
      case AudioProductionAssetType.MultiTrackSession:
        id = input.sessionId ?? context.mixingPlanId ?? "";
        break;
      case AudioProductionAssetType.VoiceProfile:
        id = context.brandName ? `voice-profile-${context.brandName.toLowerCase()}` : "";
        break;
      case AudioProductionAssetType.Template:
        id = context.mixingPlanId ? `template-${context.mixingPlanId}` : "";
        break;
      case AudioProductionAssetType.Metadata:
        id = context.audioPlanId ? `metadata-${context.audioPlanId}` : "";
        break;
      case AudioProductionAssetType.BrandAsset:
        id = context.brandId && context.brandId !== "unknown-brand" ? `brand-${context.brandId}` : context.brandName ? `brand-${context.brandName.toLowerCase()}` : "";
        break;
      case AudioProductionAssetType.AudioPreset:
        id = context.productId ? `preset-${context.productId}` : "";
        break;
    }

    if (!id && hasPrompt) return `planned-${assetType}`;
    return id;
  }

  private resolveAssetSource(
    assetType: AudioProductionAssetType,
    context: AudioProductionContext,
    input: AudioProductionInput
  ): string {
    if (input.voicePlanIds?.length && assetType === AudioProductionAssetType.VoiceTrack) return "voice-plan";
    if (input.musicPlanIds?.length && assetType === AudioProductionAssetType.MusicTrack) return "music-plan";
    if (context.mixingPlanId && assetType === AudioProductionAssetType.MultiTrackSession) return "mixing-plan";
    return "production-plan";
  }
}
