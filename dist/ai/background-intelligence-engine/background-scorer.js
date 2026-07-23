export class BackgroundScorer {
    computeScores(analysis, quality, suitability) {
        const backgroundQualityScore = Math.round((quality.visualQuality + quality.colorHarmony + analysis.backgroundCleanliness) / 3);
        const suitabilityValues = Object.values(suitability);
        const backgroundSuitabilityScore = Math.round(suitabilityValues.reduce((a, b) => a + b, 0) / suitabilityValues.length);
        const brandCompatibilityScore = Math.min(100, quality.brandCompatibility);
        const creativeReadinessScore = Math.min(100, Math.round(backgroundQualityScore * 0.4 + backgroundSuitabilityScore * 0.3 + (100 - quality.backgroundDistraction) * 0.3));
        const marketingReadinessScore = Math.min(100, quality.marketingSuitability);
        const aiConfidenceScore = Math.round((backgroundQualityScore +
            backgroundSuitabilityScore +
            brandCompatibilityScore +
            creativeReadinessScore +
            marketingReadinessScore) /
            5);
        return {
            backgroundQualityScore,
            backgroundSuitabilityScore,
            brandCompatibilityScore,
            creativeReadinessScore,
            marketingReadinessScore,
            aiConfidenceScore,
        };
    }
    isAnalysisValid(scores, backgroundLabel) {
        const diagnostics = [];
        if (!backgroundLabel || backgroundLabel === "unspecified-background") {
            diagnostics.push("Background label missing — analysis incomplete");
        }
        if (scores.backgroundQualityScore < 50) {
            diagnostics.push(`Background quality score ${scores.backgroundQualityScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=background-scorer.js.map