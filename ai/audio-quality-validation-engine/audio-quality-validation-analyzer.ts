import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import type { AudioRenderRecord } from "../audio-rendering-preparation-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import {
  ALL_AUDIO_BRAND_VALIDATION_CHECKS,
  ALL_AUDIO_QUALITY_CHECKS,
  ALL_AUDIO_QUALITY_TIMELINE_CHECKS,
  ALL_AUDIO_QUALITY_TRACK_CHECKS,
  ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS,
  ALL_AUDIO_SYNC_CHECKS,
  ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS,
  AUDIO_QUALITY_PLATFORM_CONFIG,
  AudioBrandValidationCheck,
  AudioBrandValidationEntry,
  AudioPlatformValidationEntry,
  AudioQualityCheck,
  AudioQualityIssue,
  AudioQualityIssueCategory,
  AudioQualityIssueSeverity,
  AudioQualityTimelineCheck,
  AudioQualityTimelineValidationEntry,
  AudioQualityTrackCheck,
  AudioQualityTrackValidationEntry,
  AudioQualityValidationEntry,
  AudioQualityValidationInput,
  AudioQualityValidationPlatform,
  AudioQualityValidationProfile,
  AudioSyncCheck,
  AudioSyncValidationEntry,
  AudioTechnicalValidationCheck,
  AudioTechnicalValidationEntry,
} from "./types.js";

export interface AudioQualityValidationContext {
  productId?: string;
  productName?: string;
  brandId?: string;
  brandName?: string;
  projectId?: string;
  campaignId?: string;
  industry?: string;
  validationPrompt?: string;
  productionPlan?: AudioProductionRecord | null;
  renderPlan?: AudioRenderRecord | null;
  analysis?: ProductAnalysisIntelligenceRecord | null;
}

export class AudioQualityValidationAnalyzer {
  buildProfile(
    input: AudioQualityValidationInput,
    platform: AudioQualityValidationPlatform,
    version: number,
    context: AudioQualityValidationContext
  ): AudioQualityValidationProfile {
    const productId = context.productId ?? input.productId ?? "unknown-product";
    const brandId = input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand";
    const productionId = input.productionId ?? context.productionPlan?.audioProductionId ?? `production-${productId}`;
    const renderPlanId = input.renderPlanId ?? context.renderPlan?.audioRenderPlanId ?? `render-${productionId}`;
    const audioPlanId =
      input.audioPlanId ?? context.productionPlan?.profile.audioPlanId ?? context.renderPlan?.profile.audioId ?? `audio-${productId}`;

    return {
      audioQualityValidationId: `audio-quality-validation-${renderPlanId}-${platform}-v${version}`,
      projectId: input.projectId ?? context.projectId ?? context.productionPlan?.profile.projectId ?? `project-${productId}`,
      productionId,
      renderPlanId,
      audioPlanId,
      productId,
      brandId,
      platform,
      validationVersion: version,
    };
  }

  buildAudioQualityValidation(context: AudioQualityValidationContext, platform: AudioQualityValidationPlatform): AudioQualityValidationEntry[] {
    const config = AUDIO_QUALITY_PLATFORM_CONFIG[platform];
    const renderSettings = context.renderPlan?.renderSettings;

    return ALL_AUDIO_QUALITY_CHECKS.map((check) => {
      const score = this.scoreAudioQualityCheck(check, context, config);
      return {
        check,
        validated: score >= 55,
        score,
        notes: [`${check} validated at ${config.sampleRate}Hz — blueprint analysis only`],
      };
    }).map((entry) => {
      if (renderSettings) {
        if (entry.check === AudioQualityCheck.SampleRate) {
          entry.validated = renderSettings.sampleRate >= config.sampleRate;
          entry.score = entry.validated ? 92 : 58;
        }
        if (entry.check === AudioQualityCheck.BitDepth) {
          entry.validated = renderSettings.bitDepth >= config.bitDepth;
          entry.score = entry.validated ? 90 : 55;
        }
        if (entry.check === AudioQualityCheck.Loudness) {
          entry.validated = Math.abs(renderSettings.loudnessTarget - config.loudnessTarget) <= 3;
          entry.score = entry.validated ? 88 : 60;
        }
      }
      return entry;
    });
  }

  buildTrackValidation(context: AudioQualityValidationContext): AudioQualityTrackValidationEntry[] {
    const renderTracks = context.renderPlan?.trackStructure ?? [];
    const productionTracks = context.productionPlan?.productionStructure.trackStructure ?? [];
    const trackCount = renderTracks.length || productionTracks.length;

    return ALL_AUDIO_QUALITY_TRACK_CHECKS.map((check) => ({
      check,
      validated: this.validateTrackCheck(check, trackCount, context),
      notes: [`${check} verified across ${trackCount} tracks`],
    }));
  }

  buildTimelineValidation(context: AudioQualityValidationContext): AudioQualityTimelineValidationEntry[] {
    const timeline = context.renderPlan?.timelineStructure ?? [];
    const productionTimeline = context.productionPlan?.productionStructure.timelineStructure ?? [];
    const cueCount = timeline.length || productionTimeline.length;

    return ALL_AUDIO_QUALITY_TIMELINE_CHECKS.map((check) => ({
      check,
      validated: this.validateTimelineCheck(check, cueCount, context),
      notes: [`${check} verified across ${cueCount} cues`],
    }));
  }

  buildSyncValidation(context: AudioQualityValidationContext): AudioSyncValidationEntry[] {
    const hasVoice = Boolean(
      context.productionPlan?.relationships.voicePlans.length ||
        context.renderPlan?.relationships.voicePlans.length ||
        context.validationPrompt
    );
    const hasMusic = Boolean(
      context.productionPlan?.relationships.musicPlans.length || context.renderPlan?.relationships.musicPlans.length
    );

    return ALL_AUDIO_SYNC_CHECKS.map((check) => ({
      check,
      validated: this.validateSyncCheck(check, hasVoice, hasMusic, context),
      notes: [`${check} synchronization validation — blueprint analysis`],
    }));
  }

  buildBrandValidation(context: AudioQualityValidationContext): AudioBrandValidationEntry[] {
    const brandName = context.brandName ?? context.brandId ?? "";

    return ALL_AUDIO_BRAND_VALIDATION_CHECKS.map((check) => ({
      check,
      validated: brandName.length > 0 || Boolean(context.productionPlan) || Boolean(context.validationPrompt),
      notes: brandName ? [`${check} validated for ${brandName}`] : [`${check} brand check planned`],
    }));
  }

  buildPlatformValidation(input: AudioQualityValidationInput, context: AudioQualityValidationContext): AudioPlatformValidationEntry[] {
    if (input.validatePlatform === false) {
      const platform = context.renderPlan?.profile.platform as AudioQualityValidationPlatform ?? AudioQualityValidationPlatform.Website;
      return [this.buildPlatformEntry(platform, context)];
    }
    return ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS.map((platform) => this.buildPlatformEntry(platform, context));
  }

  buildTechnicalValidation(context: AudioQualityValidationContext): AudioTechnicalValidationEntry[] {
    const renderSettings = context.renderPlan?.renderSettings;

    return ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS.map((check) => {
      let validated = true;
      if (check === AudioTechnicalValidationCheck.Codec) validated = Boolean(renderSettings?.codec);
      if (check === AudioTechnicalValidationCheck.ChannelLayout) validated = Boolean(renderSettings?.channelLayout);
      if (check === AudioTechnicalValidationCheck.Metadata) validated = Boolean(context.productionPlan?.profile.audioPlanId ?? context.renderPlan?.profile.audioId);
      if (check === AudioTechnicalValidationCheck.FileFormat) validated = Boolean(renderSettings?.codec ?? context.validationPrompt);
      if (check === AudioTechnicalValidationCheck.Compression) validated = Boolean(renderSettings?.codec) || Boolean(context.validationPrompt);
      if (check === AudioTechnicalValidationCheck.LoudnessTarget) validated = (renderSettings?.loudnessTarget ?? -16) <= -10;
      if (check === AudioTechnicalValidationCheck.ExportSettings) validated = Boolean(context.renderPlan?.outputProfiles.length);

      return { check, validated, notes: [`${check} technical validation`] };
    });
  }

  detectIssues(
    audioQuality: AudioQualityValidationEntry[],
    trackValidation: AudioQualityTrackValidationEntry[],
    timelineValidation: AudioQualityTimelineValidationEntry[],
    syncValidation: AudioSyncValidationEntry[],
    brandValidation: AudioBrandValidationEntry[],
    context: AudioQualityValidationContext
  ): AudioQualityIssue[] {
    const issues: AudioQualityIssue[] = [];
    let issueCounter = 0;

    for (const entry of audioQuality.filter((e) => !e.validated)) {
      const category =
        entry.check === AudioQualityCheck.Clipping
          ? AudioQualityIssueCategory.Clipping
          : entry.check === AudioQualityCheck.Distortion
            ? AudioQualityIssueCategory.Distortion
            : entry.check === AudioQualityCheck.Loudness
              ? AudioQualityIssueCategory.LoudnessProblem
              : AudioQualityIssueCategory.MetadataProblem;
      issues.push(
        this.createIssue(
          ++issueCounter,
          category,
          entry.score < 45 ? AudioQualityIssueSeverity.High : AudioQualityIssueSeverity.Medium,
          `Audio quality check failed: ${entry.check}`
        )
      );
    }

    for (const entry of trackValidation.filter((t) => !t.validated)) {
      issues.push(this.createIssue(++issueCounter, AudioQualityIssueCategory.BrokenTrack, AudioQualityIssueSeverity.High, `Track validation failed: ${entry.check}`));
    }

    for (const entry of timelineValidation.filter((t) => !t.validated)) {
      issues.push(this.createIssue(++issueCounter, AudioQualityIssueCategory.TimelineProblem, AudioQualityIssueSeverity.Medium, `Timeline validation failed: ${entry.check}`));
    }

    for (const entry of syncValidation.filter((s) => !s.validated)) {
      issues.push(this.createIssue(++issueCounter, AudioQualityIssueCategory.SyncProblem, AudioQualityIssueSeverity.Medium, `Synchronization issue: ${entry.check}`));
    }

    for (const entry of brandValidation.filter((b) => !b.validated)) {
      issues.push(this.createIssue(++issueCounter, AudioQualityIssueCategory.Branding, AudioQualityIssueSeverity.Low, `Brand validation failed: ${entry.check}`));
    }

    if (!context.renderPlan?.renderReady && !context.validationPrompt) {
      issues.push(this.createIssue(++issueCounter, AudioQualityIssueCategory.RenderingRisk, AudioQualityIssueSeverity.High, "Render plan not marked render-ready"));
    }

    if (!context.productionPlan?.productionReady && !context.validationPrompt) {
      issues.push(this.createIssue(++issueCounter, AudioQualityIssueCategory.RenderingRisk, AudioQualityIssueSeverity.Medium, "Production plan not marked production-ready"));
    }

    if (!context.productionPlan && !context.renderPlan && !context.validationPrompt) {
      issues.push(this.createIssue(++issueCounter, AudioQualityIssueCategory.MissingAsset, AudioQualityIssueSeverity.Critical, "Missing production and render plan references"));
    }

    return issues;
  }

  buildRecommendations(context: AudioQualityValidationContext, profile: AudioQualityValidationProfile, issues: AudioQualityIssue[]): string[] {
    const recommendations = [
      `Audio quality validation v${profile.validationVersion} completed for ${profile.platform}`,
      "Complete audio production validation before rendering and export",
    ];

    if (context.renderPlan) {
      recommendations.push(`Render plan ${context.renderPlan.audioRenderPlanId} validated for quality readiness`);
    }
    if (context.productionPlan) {
      recommendations.push(`Production plan ${context.productionPlan.audioProductionId} cross-validated`);
    }
    if (issues.length === 0) {
      recommendations.push("No quality issues detected — production approved for next stage");
    } else {
      recommendations.push(`${issues.length} issue(s) detected — review before approval`);
    }

    return recommendations;
  }

  resolvePlatform(input: AudioQualityValidationInput, context: AudioQualityValidationContext): AudioQualityValidationPlatform {
    return (
      input.platform ??
      (context.renderPlan?.profile.platform as AudioQualityValidationPlatform | undefined) ??
      (context.productionPlan?.profile.platform as AudioQualityValidationPlatform | undefined) ??
      AudioQualityValidationPlatform.Website
    );
  }

  extractContext(
    input: AudioQualityValidationInput,
    productionPlan?: AudioProductionRecord | null,
    renderPlan?: AudioRenderRecord | null,
    analysis?: ProductAnalysisIntelligenceRecord | null
  ): AudioQualityValidationContext {
    return {
      productId: input.productId ?? productionPlan?.relationships.products[0],
      productName: analysis?.productName,
      brandId: input.brandId ?? productionPlan?.profile.brandId,
      brandName: input.brandName ?? analysis?.brand,
      projectId: input.projectId ?? productionPlan?.profile.projectId,
      campaignId: input.campaignId ?? productionPlan?.profile.campaignId,
      industry: analysis?.industry,
      validationPrompt: input.validationPrompt,
      productionPlan,
      renderPlan,
      analysis: analysis ?? null,
    };
  }

  private buildPlatformEntry(platform: AudioQualityValidationPlatform, context: AudioQualityValidationContext): AudioPlatformValidationEntry {
    const config = AUDIO_QUALITY_PLATFORM_CONFIG[platform];
    const isTarget = context.renderPlan?.profile.platform === platform || context.productionPlan?.profile.platform === platform;
    const ready = isTarget && (context.renderPlan?.renderReady ?? false);

    return {
      platform,
      validated: Boolean(config.sampleRate && config.codec),
      ready: ready || Boolean(context.validationPrompt),
      notes: [`${platform}: ${config.sampleRate}Hz, ${config.codec}, ${config.loudnessTarget} LUFS`],
    };
  }

  private scoreAudioQualityCheck(
    check: AudioQualityCheck,
    context: AudioQualityValidationContext,
    config: (typeof AUDIO_QUALITY_PLATFORM_CONFIG)[AudioQualityValidationPlatform]
  ): number {
    let score = 75;
    if (context.productionPlan?.productionReady) score += 10;
    if (context.renderPlan?.renderReady) score += 10;
    if (context.validationPrompt) score += 5;

    switch (check) {
      case AudioQualityCheck.SampleRate:
        return context.renderPlan?.renderSettings.sampleRate === config.sampleRate ? 95 : score;
      case AudioQualityCheck.Clipping:
      case AudioQualityCheck.Distortion:
        return context.productionPlan || context.renderPlan ? 88 : score;
      case AudioQualityCheck.Loudness:
        return context.renderPlan ? 90 : score;
      case AudioQualityCheck.FrequencyBalance:
        return 85;
      default:
        return Math.min(100, score);
    }
  }

  private validateTrackCheck(check: AudioQualityTrackCheck, trackCount: number, context: AudioQualityValidationContext): boolean {
    if (trackCount < 3 && !context.validationPrompt) return false;
    if (context.validationPrompt) return true;
    if (context.renderPlan?.trackValidation.every((t) => t.validated)) return true;
    switch (check) {
      case AudioQualityTrackCheck.TrackStructure:
        return trackCount >= 3;
      case AudioQualityTrackCheck.TrackOrder:
        return trackCount >= 2;
      default:
        return trackCount >= 3 || Boolean(context.productionPlan);
    }
  }

  private validateTimelineCheck(check: AudioQualityTimelineCheck, cueCount: number, context: AudioQualityValidationContext): boolean {
    if (cueCount < 2 && !context.validationPrompt) return false;
    if (context.validationPrompt) return true;
    if (context.renderPlan?.timelineValidation.every((t) => t.validated)) return true;
    return cueCount >= 2 || Boolean(context.productionPlan);
  }

  private validateSyncCheck(check: AudioSyncCheck, hasVoice: boolean, hasMusic: boolean, context: AudioQualityValidationContext): boolean {
    if (context.validationPrompt) return true;
    switch (check) {
      case AudioSyncCheck.DialogueTiming:
        return hasVoice;
      case AudioSyncCheck.MusicTiming:
        return hasMusic || hasVoice;
      case AudioSyncCheck.VideoSync:
      case AudioSyncCheck.LipSyncMetadata:
        return Boolean(context.productionPlan) || Boolean(context.renderPlan);
      default:
        return Boolean(context.productionPlan) || Boolean(context.renderPlan);
    }
  }

  private createIssue(
    counter: number,
    category: AudioQualityIssueCategory,
    severity: AudioQualityIssueSeverity,
    message: string
  ): AudioQualityIssue {
    return {
      issueId: `issue-${counter}`,
      category,
      severity,
      message,
      repaired: false,
    };
  }
}
