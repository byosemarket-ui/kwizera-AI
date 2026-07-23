import { AudioQualityIssueSeverity, } from "./types.js";
export class AudioQualityValidationScorer {
    computeScores(audioQuality, trackValidation, timelineValidation, syncValidation, brandValidation, platformValidation, technicalValidation, issues) {
        const loudnessScore = this.computeLoudnessScore(audioQuality);
        const frequencyBalanceScore = this.computeFrequencyScore(audioQuality);
        const synchronizationScore = this.computePassRate(syncValidation);
        const brandConsistencyScore = this.computePassRate(brandValidation);
        const productionReadinessScore = this.computePassRate([...trackValidation, ...timelineValidation]);
        const platformCompatibilityScore = this.computePlatformScore(platformValidation);
        const technicalScore = this.computePassRate(technicalValidation);
        let overallAudioQualityScore = Math.round((this.averageScore(audioQuality.map((e) => e.score)) +
            loudnessScore +
            frequencyBalanceScore +
            synchronizationScore +
            brandConsistencyScore +
            productionReadinessScore +
            platformCompatibilityScore) /
            7);
        const criticalCount = issues.filter((i) => i.severity === AudioQualityIssueSeverity.Critical && !i.repaired).length;
        const highCount = issues.filter((i) => i.severity === AudioQualityIssueSeverity.High && !i.repaired).length;
        overallAudioQualityScore = Math.max(0, overallAudioQualityScore - criticalCount * 25 - highCount * 10);
        const aiConfidenceScore = Math.round((overallAudioQualityScore + loudnessScore + frequencyBalanceScore + synchronizationScore + brandConsistencyScore + technicalScore) / 6);
        return {
            overallAudioQualityScore,
            loudnessScore,
            frequencyBalanceScore,
            synchronizationScore,
            brandConsistencyScore,
            productionReadinessScore,
            platformCompatibilityScore,
            aiConfidenceScore,
        };
    }
    isValidationComplete(scores, issues, record) {
        const diagnostics = [];
        if (scores.overallAudioQualityScore < 55)
            diagnostics.push(`Overall audio quality score ${scores.overallAudioQualityScore} below threshold (55)`);
        if (scores.loudnessScore < 55)
            diagnostics.push(`Loudness score ${scores.loudnessScore} below threshold (55)`);
        if (scores.frequencyBalanceScore < 55)
            diagnostics.push(`Frequency balance score ${scores.frequencyBalanceScore} below threshold (55)`);
        if (scores.synchronizationScore < 55)
            diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (55)`);
        if (scores.brandConsistencyScore < 50)
            diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        const criticalIssues = issues.filter((i) => i.severity === AudioQualityIssueSeverity.Critical && !i.repaired);
        if (criticalIssues.length > 0) {
            diagnostics.push(`Unresolved critical issues: ${criticalIssues.map((i) => i.message).join("; ")}`);
        }
        if (record.audioQuality.filter((e) => !e.validated).length > 3) {
            diagnostics.push("Too many failed audio quality checks");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isApproved(scores, issues) {
        const hasCritical = issues.some((i) => i.severity === AudioQualityIssueSeverity.Critical && !i.repaired);
        return scores.overallAudioQualityScore >= 55 && scores.aiConfidenceScore >= 55 && !hasCritical;
    }
    averageScore(scores) {
        if (scores.length === 0)
            return 0;
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    computeLoudnessScore(audioQuality) {
        const loudnessChecks = audioQuality.filter((e) => e.check.includes("loudness") || e.check.includes("peak") || e.check.includes("clipping"));
        return loudnessChecks.length > 0 ? this.averageScore(loudnessChecks.map((e) => e.score)) : 75;
    }
    computeFrequencyScore(audioQuality) {
        const freqChecks = audioQuality.filter((e) => e.check.includes("frequency") || e.check.includes("noise") || e.check.includes("distortion"));
        return freqChecks.length > 0 ? this.averageScore(freqChecks.map((e) => e.score)) : 75;
    }
    computePassRate(entries) {
        const validated = entries.filter((e) => e.validated).length;
        return Math.min(100, Math.round(45 + (validated / Math.max(entries.length, 1)) * 55));
    }
    computePlatformScore(platformValidation) {
        const ready = platformValidation.filter((p) => p.ready).length;
        const validated = platformValidation.filter((p) => p.validated).length;
        return Math.min(100, Math.round(40 + (ready / Math.max(platformValidation.length, 1)) * 30 + (validated / Math.max(platformValidation.length, 1)) * 30));
    }
}
//# sourceMappingURL=audio-quality-validation-scorer.js.map