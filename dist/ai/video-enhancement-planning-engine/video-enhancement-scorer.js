export class VideoEnhancementScorer {
    computeScores(quality, recommendationCount, platformRuleCount, productionBase, styleConsistency) {
        let enhancementReadinessScore = 55;
        if (recommendationCount >= 3)
            enhancementReadinessScore += 10;
        if (platformRuleCount >= 4)
            enhancementReadinessScore += 10;
        if (quality.visualClarity >= 70)
            enhancementReadinessScore += 5;
        if (quality.audioQuality >= 70)
            enhancementReadinessScore += 5;
        enhancementReadinessScore = Math.min(100, enhancementReadinessScore);
        const visualQualityScore = Math.round((quality.visualClarity + quality.frameQuality + quality.colorAccuracy + quality.lighting) / 4);
        const audioQualityScore = quality.audioQuality;
        const motionQualityScore = Math.round((quality.motionQuality + quality.stabilization) / 2);
        const productionReadinessScore = Math.round((productionBase + enhancementReadinessScore + visualQualityScore) / 3);
        const aiConfidenceScore = Math.round((enhancementReadinessScore +
            visualQualityScore +
            audioQualityScore +
            motionQualityScore +
            productionReadinessScore +
            styleConsistency) /
            6);
        return {
            enhancementReadinessScore,
            visualQualityScore,
            audioQualityScore,
            motionQualityScore,
            productionReadinessScore,
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isPlanValid(scores, recommendationCount, platformCount, nonDestructiveValid) {
        const diagnostics = [];
        if (recommendationCount < 2)
            diagnostics.push("At least 2 enhancement recommendations required");
        if (platformCount < 4)
            diagnostics.push("At least 4 platform optimization rules required");
        if (!nonDestructiveValid)
            diagnostics.push("Non-destructive policy must preserve original and support undo/redo");
        if (scores.enhancementReadinessScore < 55) {
            diagnostics.push(`Enhancement readiness ${scores.enhancementReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=video-enhancement-scorer.js.map