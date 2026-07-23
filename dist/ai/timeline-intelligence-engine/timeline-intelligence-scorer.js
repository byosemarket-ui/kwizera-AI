export class TimelineIntelligenceScorer {
    computeScores(timelineLengthMs, sceneCount, shotCount, trackCount, variantCount, synchronization, optimization, editingReadiness, renderingReadiness, frameConsistencyScore) {
        let timelineQualityScore = 55;
        if (timelineLengthMs > 0)
            timelineQualityScore += 10;
        if (sceneCount >= 3)
            timelineQualityScore += 15;
        if (shotCount >= sceneCount)
            timelineQualityScore += 10;
        if (variantCount >= 3)
            timelineQualityScore += 5;
        timelineQualityScore = Math.min(100, timelineQualityScore);
        const synchronizationScore = synchronization.overallSyncScore;
        const storyFlowScore = optimization.storyFlowScore;
        const productionReadinessScore = Math.round((editingReadiness + renderingReadiness) / 2);
        let performanceScore = 60;
        if (optimization.resourceUsageScore >= 80)
            performanceScore += 15;
        if (optimization.renderingEfficiencyScore >= 75)
            performanceScore += 15;
        if (trackCount <= 12)
            performanceScore += 5;
        performanceScore += Math.round(frameConsistencyScore * 0.05);
        performanceScore = Math.min(100, performanceScore);
        const aiConfidenceScore = Math.round((timelineQualityScore +
            synchronizationScore +
            storyFlowScore +
            productionReadinessScore +
            performanceScore +
            optimization.timelineFlowScore) /
            6);
        return {
            timelineQualityScore,
            synchronizationScore,
            storyFlowScore,
            productionReadinessScore,
            performanceScore,
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isTimelineValid(scores, sceneCount, trackCount) {
        const diagnostics = [];
        if (sceneCount < 2) {
            diagnostics.push("Minimum 2 scenes required for validated timeline");
        }
        if (trackCount < 3) {
            diagnostics.push("Minimum 3 tracks required for validated timeline");
        }
        if (scores.timelineQualityScore < 55) {
            diagnostics.push(`Timeline quality ${scores.timelineQualityScore} below threshold (55)`);
        }
        if (scores.synchronizationScore < 50) {
            diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=timeline-intelligence-scorer.js.map