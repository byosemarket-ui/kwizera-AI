import { ALL_AUDIO_BRAND_VALIDATION_CHECKS, ALL_AUDIO_QUALITY_CHECKS, ALL_AUDIO_QUALITY_TIMELINE_CHECKS, ALL_AUDIO_QUALITY_TRACK_CHECKS, ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS, ALL_AUDIO_SYNC_CHECKS, ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS, AUDIO_QUALITY_PLATFORM_CONFIG, AudioQualityCheck, AudioQualityIssueCategory, AudioQualityIssueSeverity, AudioQualityTrackCheck, AudioQualityValidationPlatform, AudioSyncCheck, AudioTechnicalValidationCheck, } from "./types.js";
export class AudioQualityValidationAnalyzer {
    buildProfile(input, platform, version, context) {
        const productId = context.productId ?? input.productId ?? "unknown-product";
        const brandId = input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand";
        const productionId = input.productionId ?? context.productionPlan?.audioProductionId ?? `production-${productId}`;
        const renderPlanId = input.renderPlanId ?? context.renderPlan?.audioRenderPlanId ?? `render-${productionId}`;
        const audioPlanId = input.audioPlanId ?? context.productionPlan?.profile.audioPlanId ?? context.renderPlan?.profile.audioId ?? `audio-${productId}`;
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
    buildAudioQualityValidation(context, platform) {
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
    buildTrackValidation(context) {
        const renderTracks = context.renderPlan?.trackStructure ?? [];
        const productionTracks = context.productionPlan?.productionStructure.trackStructure ?? [];
        const trackCount = renderTracks.length || productionTracks.length;
        return ALL_AUDIO_QUALITY_TRACK_CHECKS.map((check) => ({
            check,
            validated: this.validateTrackCheck(check, trackCount, context),
            notes: [`${check} verified across ${trackCount} tracks`],
        }));
    }
    buildTimelineValidation(context) {
        const timeline = context.renderPlan?.timelineStructure ?? [];
        const productionTimeline = context.productionPlan?.productionStructure.timelineStructure ?? [];
        const cueCount = timeline.length || productionTimeline.length;
        return ALL_AUDIO_QUALITY_TIMELINE_CHECKS.map((check) => ({
            check,
            validated: this.validateTimelineCheck(check, cueCount, context),
            notes: [`${check} verified across ${cueCount} cues`],
        }));
    }
    buildSyncValidation(context) {
        const hasVoice = Boolean(context.productionPlan?.relationships.voicePlans.length ||
            context.renderPlan?.relationships.voicePlans.length ||
            context.validationPrompt);
        const hasMusic = Boolean(context.productionPlan?.relationships.musicPlans.length || context.renderPlan?.relationships.musicPlans.length);
        return ALL_AUDIO_SYNC_CHECKS.map((check) => ({
            check,
            validated: this.validateSyncCheck(check, hasVoice, hasMusic, context),
            notes: [`${check} synchronization validation — blueprint analysis`],
        }));
    }
    buildBrandValidation(context) {
        const brandName = context.brandName ?? context.brandId ?? "";
        return ALL_AUDIO_BRAND_VALIDATION_CHECKS.map((check) => ({
            check,
            validated: brandName.length > 0 || Boolean(context.productionPlan) || Boolean(context.validationPrompt),
            notes: brandName ? [`${check} validated for ${brandName}`] : [`${check} brand check planned`],
        }));
    }
    buildPlatformValidation(input, context) {
        if (input.validatePlatform === false) {
            const platform = context.renderPlan?.profile.platform ?? AudioQualityValidationPlatform.Website;
            return [this.buildPlatformEntry(platform, context)];
        }
        return ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS.map((platform) => this.buildPlatformEntry(platform, context));
    }
    buildTechnicalValidation(context) {
        const renderSettings = context.renderPlan?.renderSettings;
        return ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS.map((check) => {
            let validated = true;
            if (check === AudioTechnicalValidationCheck.Codec)
                validated = Boolean(renderSettings?.codec);
            if (check === AudioTechnicalValidationCheck.ChannelLayout)
                validated = Boolean(renderSettings?.channelLayout);
            if (check === AudioTechnicalValidationCheck.Metadata)
                validated = Boolean(context.productionPlan?.profile.audioPlanId ?? context.renderPlan?.profile.audioId);
            if (check === AudioTechnicalValidationCheck.FileFormat)
                validated = Boolean(renderSettings?.codec ?? context.validationPrompt);
            if (check === AudioTechnicalValidationCheck.Compression)
                validated = Boolean(renderSettings?.codec) || Boolean(context.validationPrompt);
            if (check === AudioTechnicalValidationCheck.LoudnessTarget)
                validated = (renderSettings?.loudnessTarget ?? -16) <= -10;
            if (check === AudioTechnicalValidationCheck.ExportSettings)
                validated = Boolean(context.renderPlan?.outputProfiles.length);
            return { check, validated, notes: [`${check} technical validation`] };
        });
    }
    detectIssues(audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, context) {
        const issues = [];
        let issueCounter = 0;
        for (const entry of audioQuality.filter((e) => !e.validated)) {
            const category = entry.check === AudioQualityCheck.Clipping
                ? AudioQualityIssueCategory.Clipping
                : entry.check === AudioQualityCheck.Distortion
                    ? AudioQualityIssueCategory.Distortion
                    : entry.check === AudioQualityCheck.Loudness
                        ? AudioQualityIssueCategory.LoudnessProblem
                        : AudioQualityIssueCategory.MetadataProblem;
            issues.push(this.createIssue(++issueCounter, category, entry.score < 45 ? AudioQualityIssueSeverity.High : AudioQualityIssueSeverity.Medium, `Audio quality check failed: ${entry.check}`));
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
    buildRecommendations(context, profile, issues) {
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
        }
        else {
            recommendations.push(`${issues.length} issue(s) detected — review before approval`);
        }
        return recommendations;
    }
    resolvePlatform(input, context) {
        return (input.platform ??
            context.renderPlan?.profile.platform ??
            context.productionPlan?.profile.platform ??
            AudioQualityValidationPlatform.Website);
    }
    extractContext(input, productionPlan, renderPlan, analysis) {
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
    buildPlatformEntry(platform, context) {
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
    scoreAudioQualityCheck(check, context, config) {
        let score = 75;
        if (context.productionPlan?.productionReady)
            score += 10;
        if (context.renderPlan?.renderReady)
            score += 10;
        if (context.validationPrompt)
            score += 5;
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
    validateTrackCheck(check, trackCount, context) {
        if (trackCount < 3 && !context.validationPrompt)
            return false;
        if (context.validationPrompt)
            return true;
        if (context.renderPlan?.trackValidation.every((t) => t.validated))
            return true;
        switch (check) {
            case AudioQualityTrackCheck.TrackStructure:
                return trackCount >= 3;
            case AudioQualityTrackCheck.TrackOrder:
                return trackCount >= 2;
            default:
                return trackCount >= 3 || Boolean(context.productionPlan);
        }
    }
    validateTimelineCheck(check, cueCount, context) {
        if (cueCount < 2 && !context.validationPrompt)
            return false;
        if (context.validationPrompt)
            return true;
        if (context.renderPlan?.timelineValidation.every((t) => t.validated))
            return true;
        return cueCount >= 2 || Boolean(context.productionPlan);
    }
    validateSyncCheck(check, hasVoice, hasMusic, context) {
        if (context.validationPrompt)
            return true;
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
    createIssue(counter, category, severity, message) {
        return {
            issueId: `issue-${counter}`,
            category,
            severity,
            message,
            repaired: false,
        };
    }
}
//# sourceMappingURL=audio-quality-validation-analyzer.js.map