export class EnhancementPlanningScorer {
    computeScores(quality, platformReadiness, hasRestorationNeed) {
        const imageQualityScore = Math.round((quality.resolutionQuality +
            quality.sharpness +
            quality.visualClarity +
            quality.colorAccuracy +
            (100 - quality.noise)) /
            5);
        const restorationScore = hasRestorationNeed
            ? Math.max(40, 100 - quality.compressionArtifacts - Math.round(quality.noise * 0.5))
            : Math.min(100, 85 + Math.round(quality.sharpness * 0.1));
        const enhancementReadinessScore = Math.round((imageQualityScore + restorationScore + platformReadiness) / 3);
        const creativeReadinessScore = Math.min(100, Math.round(imageQualityScore * 0.5 + enhancementReadinessScore * 0.3 + platformReadiness * 0.2));
        const marketingReadinessProxy = Math.round((quality.contrast + quality.exposure + quality.colorAccuracy) / 3);
        const platformReadinessScore = platformReadiness;
        const aiConfidenceScore = Math.round((enhancementReadinessScore +
            imageQualityScore +
            restorationScore +
            platformReadinessScore +
            creativeReadinessScore) /
            5);
        return {
            enhancementReadinessScore,
            imageQualityScore,
            restorationScore,
            platformReadinessScore,
            creativeReadinessScore,
            aiConfidenceScore,
        };
    }
    computePlatformReadiness(quality, platform) {
        let score = Math.round((quality.resolutionQuality + quality.visualClarity) / 2);
        if (platform === "tiktok" || platform === "instagram") {
            score -= quality.compressionArtifacts > 30 ? 10 : 0;
        }
        if (platform === "youtube") {
            score += quality.resolutionQuality >= 80 ? 8 : -5;
        }
        return Math.max(0, Math.min(100, score));
    }
    isPlanValid(scores, quality) {
        const diagnostics = [];
        if (quality.sharpness <= 0 && quality.resolutionQuality <= 0) {
            diagnostics.push("Image quality analysis incomplete — cannot validate enhancement plan");
        }
        if (scores.imageQualityScore < 40) {
            diagnostics.push(`Image quality score ${scores.imageQualityScore} too low for planning approval`);
        }
        if (scores.enhancementReadinessScore < 50) {
            diagnostics.push(`Enhancement readiness ${scores.enhancementReadinessScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=enhancement-planning-scorer.js.map