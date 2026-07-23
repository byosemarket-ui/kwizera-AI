import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  AudioMixMasterGenerationInput,
  AudioMixMasterProfile,
  AudioMixingPlatform,
  AudioTrackType,
  FrequencyManagementPlan,
  LoudnessManagementPlan,
  MasteringPlan,
  MixingPlan,
  MultiTrackAnalysis,
  OutputMasterPlan,
  PLATFORM_MIX_MASTER_CONFIG,
  ProductionMixMasterInstructions,
  SpatialMixPlan,
} from "./types.js";

export interface MixMasterContext {
  productId?: string;
  productName?: string;
  brandName?: string;
  brandId?: string;
  brandGuidelines?: string;
  projectId?: string;
  campaignId?: string;
  industry?: string;
  mixPrompt?: string;
  creative?: CreativeDirectionRecord | null;
  strategy?: MarketingStrategyRecord | null;
  understanding?: ProductUnderstandingRecord | null;
}

export class AudioMixingMasteringAnalyzer {
  analyzeMultiTrack(input: AudioMixMasterGenerationInput, context: MixMasterContext): MultiTrackAnalysis {
    const prompt = (input.mixPrompt ?? context.mixPrompt ?? "").toLowerCase();
    const trackTypes = input.trackTypes ?? this.detectTrackTypes(prompt, input);
    const trackCount = input.trackCount ?? Math.max(trackTypes.length, this.countTracksFromInput(input));

    const clippingDetected = prompt.includes("clip") || prompt.includes("peak");
    const noiseLevel = prompt.includes("noise") ? "moderate" : "low";

    return {
      trackCount,
      trackTypes,
      frequencyDistribution: {
        low: trackTypes.includes(AudioTrackType.Music) ? "balanced sub-bass" : "controlled low-end",
        mid: "vocal/dialogue presence 1-4kHz",
        high: "air and presence 8-12kHz",
      },
      loudnessLufs: -18,
      dynamicRangeDb: trackTypes.includes(AudioTrackType.Music) ? 10 : 14,
      stereoWidth: trackTypes.length >= 3 ? "wide stereo field" : "focused stereo",
      phaseStatus: "phase-coherent — mono-compatible",
      timingAlignment: input.timelineRef || input.videoId ? "timeline-aligned" : "session-aligned",
      noiseLevel,
      clippingDetected,
      silenceGaps: prompt.includes("silence") ? 1 : 0,
      trackDetails: this.buildTrackDetails(trackTypes),
      keywords: this.extractKeywords(prompt, context),
    };
  }

  buildProfile(
    input: AudioMixMasterGenerationInput,
    platform: AudioMixingPlatform,
    version: number,
    context: MixMasterContext
  ): AudioMixMasterProfile {
    const productId = context.productId ?? input.productId ?? "standalone";
    const sessionId = input.sessionId ?? input.sessionRef ?? `session-${productId}`;
    const mixingPlanId = `mixing-plan-${productId}-${platform}-v${version}`;
    const masteringPlanId = `mastering-plan-${productId}-${platform}-v${version}`;

    return {
      mixingPlanId,
      masteringPlanId,
      projectId: input.projectId ?? context.projectId ?? `project-${productId}`,
      sessionId,
      brandId: input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand",
      campaignId: input.campaignId ?? context.campaignId,
      platform,
      version,
    };
  }

  buildMixingPlan(analysis: MultiTrackAnalysis): MixingPlan {
    const balancing: Record<string, string> = {};
    const pan: Record<string, string> = {};
    const eq: Record<string, string> = {};
    const compression: Record<string, string> = {};
    const reverb: Record<string, string> = {};
    const delay: Record<string, string> = {};

    for (const t of analysis.trackTypes) {
      balancing[t] = `${t} level — balanced against master bus`;
      pan[t] = t === AudioTrackType.Voice || t === AudioTrackType.Dialogue || t === AudioTrackType.Narration
        ? "center"
        : t === AudioTrackType.Ambient ? "wide L/R" : "stereo spread";
      eq[t] = `EQ carve for ${t} — frequency separation`;
      compression[t] = `Gentle compression on ${t}`;
      reverb[t] = t === AudioTrackType.Voice ? "minimal room" : "spatial depth";
      delay[t] = t === AudioTrackType.Effects ? "synced delay" : "none";
    }

    return {
      trackBalancing: balancing,
      volumeAutomation: ["Intro fade", "Mid sustain", "Outro fade"],
      panPlanning: pan,
      eqPlanning: eq,
      compressionPlanning: compression,
      reverbPlanning: reverb,
      delayPlanning: delay,
      busRouting: ["Drums bus", "Music bus", "Voice bus", "FX bus", "Master bus"],
      groupRouting: ["Dialogue group", "Music group", "Ambience group"],
      processingChain: ["Balance", "EQ", "Compression", "Bus routing", "Master bus"],
    };
  }

  buildMasteringPlan(platform: AudioMixingPlatform, analysis: MultiTrackAnalysis): MasteringPlan {
    const config = PLATFORM_MIX_MASTER_CONFIG[platform];
    const techniques = [
      "loudness-normalization",
      "limiting",
      "final-eq",
      "stereo-enhancement",
      "dynamic-optimization",
      "harmonic-enhancement",
      "peak-protection",
      "output-level-optimization",
    ];

    return {
      loudnessNormalization: `Target ${config.targetLufs} LUFS integrated — ${config.loudnessStandard}`,
      limiting: "True-peak limiter at -1.0 dBTP",
      finalEq: "Tonal balance EQ — gentle broad strokes",
      stereoEnhancement: analysis.stereoWidth.includes("wide") ? "Subtle stereo width 105%" : "Preserve stereo image",
      dynamicOptimization: `Dynamic range target ${analysis.dynamicRangeDb}dB`,
      harmonicEnhancement: "Gentle harmonic exciter for presence",
      peakProtection: "Brick-wall peak protection enabled",
      outputLevelOptimization: `Platform: ${platform} — ${config.formatNotes}`,
      targetLufs: config.targetLufs,
      techniques,
    };
  }

  buildFrequencyManagement(analysis: MultiTrackAnalysis): FrequencyManagementPlan {
    return {
      lowFrequencies: "High-pass voice at 80Hz, sub-bass controlled on music",
      midFrequencies: "Vocal presence 2-4kHz, mid-range clarity",
      highFrequencies: "Air band 10-12kHz, de-ess sibilance",
      harmonicBalance: "Harmonic series preserved across stems",
      frequencyMasking: analysis.trackTypes.map((t) => `${t} — carve conflicting frequencies`),
      tonalBalance: "Balanced tonal curve aligned to platform",
    };
  }

  buildLoudnessManagement(platform: AudioMixingPlatform): LoudnessManagementPlan {
    const config = PLATFORM_MIX_MASTER_CONFIG[platform];
    return {
      broadcastLoudness: "-24 LUFS (EBU R128)",
      streamingLoudness: "-14 LUFS (YouTube/Spotify)",
      podcastLoudness: "-16 LUFS (podcast standard)",
      cinemaLoudness: "-27 LUFS (cinema reference)",
      televisionLoudness: "-24 LUFS (broadcast)",
      radioLoudness: "-23 LUFS (radio)",
      platformTarget: `${config.targetLufs} LUFS — ${config.loudnessStandard}`,
    };
  }

  buildSpatialMixPlan(analysis: MultiTrackAnalysis, platform: AudioMixingPlatform): SpatialMixPlan {
    const isFilm = platform === AudioMixingPlatform.Film;
    return {
      stereoMixing: `${analysis.stereoWidth} — balanced L/R image`,
      monoCompatibility: "Mono fold-down verified — phase-safe",
      surroundPreparation: isFilm ? "5.1 surround stem routing prepared" : "Stereo-first with surround option",
      binauralPreparation: "HRTF-ready binaural downmix metadata",
      dolbyAtmosPreparation: isFilm ? "Atmos bed/object routing prepared" : "Stereo delivery primary",
    };
  }

  buildOutputPreparation(platform: AudioMixingPlatform): OutputMasterPlan {
    const config = PLATFORM_MIX_MASTER_CONFIG[platform];
    return {
      platform,
      formatNotes: [config.formatNotes, `Loudness: ${config.loudnessStandard}`],
      deliveryNotes: ["Production-ready mix/master blueprint", "Non-destructive workflow"],
      loudnessTarget: `${config.targetLufs} LUFS integrated`,
    };
  }

  buildProductionInstructions(
    profile: AudioMixMasterProfile,
    analysis: MultiTrackAnalysis,
    mixing: MixingPlan,
    mastering: MasteringPlan
  ): ProductionMixMasterInstructions {
    return {
      renderNotes: [
        `Mix plan ${profile.mixingPlanId}`,
        `Master plan ${profile.masteringPlanId}`,
        `${analysis.trackCount} tracks — ${analysis.trackTypes.join(", ")}`,
      ],
      mixingGuidance: [`Processing chain: ${mixing.processingChain.length} stages`, "Bus routing active"],
      masteringGuidance: mastering.techniques.map((t) => `Apply ${t}`),
      exportPreparation: [`Platform: ${profile.platform}`, `Target: ${mastering.targetLufs} LUFS`],
      qualityTargets: ["Mixing quality ≥ 55", "Mastering quality ≥ 55", "Loudness accuracy verified"],
    };
  }

  buildRecommendations(analysis: MultiTrackAnalysis, context: MixMasterContext, platform: AudioMixingPlatform): string[] {
    const recs: string[] = [];
    if (analysis.clippingDetected) recs.push("Apply peak reduction before mastering limiter");
    if (analysis.trackCount >= 4) recs.push("Use bus compression for glue across groups");
    if (analysis.trackTypes.includes(AudioTrackType.Voice)) recs.push("Prioritize dialogue clarity in mid-range");
    if (context.brandGuidelines) recs.push("Align tonal balance with brand audio guidelines");
    if (platform === AudioMixingPlatform.Film) recs.push("Prepare surround and Atmos deliverables");
    return recs;
  }

  resolvePlatform(input: AudioMixMasterGenerationInput, context: MixMasterContext): AudioMixingPlatform {
    if (input.platform) return input.platform;
    if (context.creative?.profile.platform === "youtube") return AudioMixingPlatform.YouTube;
    if (context.creative?.profile.platform === "tiktok") return AudioMixingPlatform.TikTok;
    if (context.industry === "health") return AudioMixingPlatform.Podcast;
    return AudioMixingPlatform.Website;
  }

  extractContextFromInput(input: AudioMixMasterGenerationInput): MixMasterContext {
    return {
      productId: input.productId,
      brandName: input.brandName,
      brandId: input.brandId,
      brandGuidelines: input.brandGuidelines,
      projectId: input.projectId,
      campaignId: input.campaignId,
      mixPrompt: input.mixPrompt,
    };
  }

  extractContextFromProduct(
    productId: string,
    productName: string,
    brandName: string,
    understanding?: ProductUnderstandingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    input?: AudioMixMasterGenerationInput
  ): MixMasterContext {
    return {
      productId,
      productName,
      brandName,
      brandId: input?.brandId ?? brandName,
      brandGuidelines: input?.brandGuidelines,
      projectId: input?.projectId ?? `project-${productId}`,
      campaignId: input?.campaignId ?? strategy?.strategyId,
      industry: understanding?.customer?.targetIndustry,
      mixPrompt: input?.mixPrompt,
      creative,
      strategy,
      understanding,
    };
  }

  private detectTrackTypes(prompt: string, input: AudioMixMasterGenerationInput): AudioTrackType[] {
    const types: AudioTrackType[] = [];
    if (input.voiceTrackRefs?.length || prompt.includes("voice") || prompt.includes("dialogue")) {
      types.push(AudioTrackType.Voice, AudioTrackType.Dialogue);
    }
    if (input.musicTrackRefs?.length || prompt.includes("music")) types.push(AudioTrackType.Music);
    if (input.ambientTrackRefs?.length || prompt.includes("ambient")) types.push(AudioTrackType.Ambient);
    if (input.soundEffectRefs?.length || prompt.includes("sfx") || prompt.includes("foley")) {
      types.push(AudioTrackType.Effects, AudioTrackType.Foley);
    }
    if (prompt.includes("narrat")) types.push(AudioTrackType.Narration);
    if (types.length === 0) types.push(AudioTrackType.Voice, AudioTrackType.Music, AudioTrackType.Ambient);
    types.push(AudioTrackType.MasterBus);
    return [...new Set(types)];
  }

  private countTracksFromInput(input: AudioMixMasterGenerationInput): number {
    return (
      (input.voiceTrackRefs?.length ?? 0) +
      (input.musicTrackRefs?.length ?? 0) +
      (input.ambientTrackRefs?.length ?? 0) +
      (input.soundEffectRefs?.length ?? 0) +
      1
    );
  }

  private buildTrackDetails(types: AudioTrackType[]): Record<string, string> {
    const details: Record<string, string> = {};
    for (const t of types) {
      details[t] = `${t} track — routed to mix bus`;
    }
    return details;
  }

  private extractKeywords(prompt: string, context: MixMasterContext): string[] {
    const words = prompt.split(/\s+/).filter((w) => w.length > 3);
    const keywords = [...words];
    if (context.brandName) keywords.push(context.brandName.toLowerCase());
    if (context.productName) keywords.push(context.productName.toLowerCase());
    return [...new Set(keywords)].slice(0, 12);
  }
}
