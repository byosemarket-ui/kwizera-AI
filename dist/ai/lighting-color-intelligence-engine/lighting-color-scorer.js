export class LightingColorScorer {
    computeScores(lighting, color, lightingSuitability, colorSuitability) {
        const lightingQualityScore = Math.round((lighting.lightingIntensity +
            lighting.lightingUniformity +
            (100 - lighting.overexposure) +
            (100 - lighting.underexposure)) /
            4);
        const colorQualityScore = Math.round((color.colorHarmony + color.colorContrast + color.saturation + color.vibrance) / 4);
        const brandColorScore = Math.min(100, color.brandColorMatching);
        const lightingValues = Object.values(lightingSuitability);
        const colorValues = Object.values(colorSuitability);
        const marketingReadinessScore = Math.round((lightingValues.reduce((a, b) => a + b, 0) / lightingValues.length +
            colorValues.reduce((a, b) => a + b, 0) / colorValues.length) /
            2);
        let creativeReadinessScore = 55;
        if (lighting.lightingUniformity >= 70)
            creativeReadinessScore += 12;
        if (color.colorHarmony >= 70)
            creativeReadinessScore += 12;
        if (color.brandColorMatching >= 65)
            creativeReadinessScore += 10;
        if (lighting.overexposure < 10 && lighting.underexposure < 10)
            creativeReadinessScore += 8;
        creativeReadinessScore = Math.min(100, creativeReadinessScore);
        const aiConfidenceScore = Math.round((lightingQualityScore +
            colorQualityScore +
            brandColorScore +
            marketingReadinessScore +
            creativeReadinessScore) /
            5);
        return {
            lightingQualityScore,
            colorQualityScore,
            brandColorScore,
            marketingReadinessScore,
            creativeReadinessScore,
            aiConfidenceScore,
        };
    }
    isAnalysisValid(scores, color) {
        const diagnostics = [];
        if (color.dominantColors.length === 0 && color.colorPalette.length === 0) {
            diagnostics.push("Color palette missing — color analysis incomplete");
        }
        if (scores.lightingQualityScore < 50) {
            diagnostics.push(`Lighting quality score ${scores.lightingQualityScore} below threshold (50)`);
        }
        if (scores.colorQualityScore < 50) {
            diagnostics.push(`Color quality score ${scores.colorQualityScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=lighting-color-scorer.js.map