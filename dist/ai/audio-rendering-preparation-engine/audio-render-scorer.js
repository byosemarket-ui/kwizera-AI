export class AudioRenderScorer {
    computeScores(renderValidation, trackValidation, timelineValidation, assetValidation, renderSettings, outputProfiles, resourcePlanning, context) {
        const workflowScore = this.computeRenderValidationScore(renderValidation);
        const trackIntegrityScore = this.computeTrackIntegrity(trackValidation);
        const timelineIntegrityScore = this.computeTimelineIntegrity(timelineValidation);
        const assetQualityScore = this.computeAssetQuality(assetValidation, context);
        const platformCompatibilityScore = this.computePlatformCompatibility(outputProfiles, renderSettings);
        const performanceScore = this.computePerformanceScore(resourcePlanning, renderValidation);
        const renderReadinessScore = Math.round((workflowScore + trackIntegrityScore + timelineIntegrityScore + assetQualityScore + platformCompatibilityScore) / 5);
        const aiConfidenceScore = Math.round((renderReadinessScore + trackIntegrityScore + timelineIntegrityScore + assetQualityScore + performanceScore + platformCompatibilityScore) / 6);
        return {
            renderReadinessScore,
            assetQualityScore,
            trackIntegrityScore,
            timelineIntegrityScore,
            performanceScore,
            platformCompatibilityScore,
            aiConfidenceScore,
        };
    }
    isRenderPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.renderReadinessScore < 55)
            diagnostics.push(`Render readiness score ${scores.renderReadinessScore} below threshold (55)`);
        if (scores.assetQualityScore < 55)
            diagnostics.push(`Asset quality score ${scores.assetQualityScore} below threshold (55)`);
        if (scores.trackIntegrityScore < 55)
            diagnostics.push(`Track integrity score ${scores.trackIntegrityScore} below threshold (55)`);
        if (scores.timelineIntegrityScore < 55)
            diagnostics.push(`Timeline integrity score ${scores.timelineIntegrityScore} below threshold (55)`);
        if (scores.platformCompatibilityScore < 55)
            diagnostics.push(`Platform compatibility score ${scores.platformCompatibilityScore} below threshold (55)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        const failedValidation = record.renderValidation.filter((v) => !v.validated);
        if (failedValidation.length > 0) {
            diagnostics.push(`Render validation failed for: ${failedValidation.map((v) => v.stage).join(", ")}`);
        }
        const failedTracks = record.trackValidation.filter((t) => !t.validated);
        if (failedTracks.length > 0) {
            diagnostics.push(`Track validation failed for: ${failedTracks.map((t) => t.check).join(", ")}`);
        }
        const failedTimeline = record.timelineValidation.filter((t) => !t.validated);
        if (failedTimeline.length > 0) {
            diagnostics.push(`Timeline validation failed for: ${failedTimeline.map((t) => t.check).join(", ")}`);
        }
        if (record.renderSettings.instructions.length < 2) {
            diagnostics.push("Render settings incomplete");
        }
        if (record.resourcePlanning.renderQueue.length < 1 && record.resourcePlanning.notes.length < 1) {
            diagnostics.push("Resource planning incomplete");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isRenderReady(scores, record) {
        return (scores.renderReadinessScore >= 55 &&
            scores.trackIntegrityScore >= 55 &&
            scores.timelineIntegrityScore >= 55 &&
            record.renderValidation.every((v) => v.validated) &&
            record.trackValidation.every((t) => t.validated) &&
            record.timelineValidation.every((t) => t.validated) &&
            record.renderSettings.instructions.length >= 2);
    }
    isProductionReady(context) {
        return Boolean(context.productionPlan?.productionReady);
    }
    computeRenderValidationScore(renderValidation) {
        const validated = renderValidation.filter((v) => v.validated).length;
        return Math.min(100, Math.round(45 + (validated / Math.max(renderValidation.length, 1)) * 55));
    }
    computeTrackIntegrity(trackValidation) {
        const validated = trackValidation.filter((t) => t.validated).length;
        return Math.min(100, Math.round(45 + (validated / Math.max(trackValidation.length, 1)) * 55));
    }
    computeTimelineIntegrity(timelineValidation) {
        const validated = timelineValidation.filter((t) => t.validated).length;
        return Math.min(100, Math.round(45 + (validated / Math.max(timelineValidation.length, 1)) * 55));
    }
    computeAssetQuality(assetValidation, context) {
        const validated = assetValidation.filter((a) => a.validated).length;
        let score = Math.min(100, Math.round(40 + (validated / Math.max(assetValidation.length, 1)) * 45));
        if (context.productionPlan)
            score += 5;
        if (context.renderPrompt)
            score += 5;
        return Math.min(100, score);
    }
    computePlatformCompatibility(outputProfiles, renderSettings) {
        let score = 45;
        if (outputProfiles.length >= 4)
            score += 25;
        if (outputProfiles.length >= 10)
            score += 15;
        if (renderSettings.sampleRate >= 44100)
            score += 10;
        if (renderSettings.instructions.length >= 3)
            score += 5;
        return Math.min(100, score);
    }
    computePerformanceScore(resourcePlanning, renderValidation) {
        let score = 50;
        if (resourcePlanning.cpuAllocation.length >= 5)
            score += 10;
        if (resourcePlanning.gpuAllocation.length >= 5)
            score += 10;
        if (resourcePlanning.ramAllocation.length >= 5)
            score += 10;
        if (resourcePlanning.renderQueue.length >= 1)
            score += 10;
        if (renderValidation.every((v) => v.validated))
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=audio-render-scorer.js.map