export class MotionIntelligenceScorer {
    computeScores(metrics, objectMotions, subjectTracks, eventCount, productionBase, cinematicBase) {
        let motionQualityScore = 55;
        if (metrics.presence)
            motionQualityScore += 5;
        if (objectMotions.length >= 2)
            motionQualityScore += 10;
        if (subjectTracks.length >= 1)
            motionQualityScore += 10;
        if (eventCount >= 3)
            motionQualityScore += 10;
        if (metrics.continuity >= 70)
            motionQualityScore += 5;
        motionQualityScore = Math.min(100, motionQualityScore);
        const motionStabilityScore = Math.round((metrics.stability + metrics.continuity) / 2);
        const trackingAccuracyScore = subjectTracks.length > 0
            ? Math.round(subjectTracks.reduce((s, t) => s + t.trackingAccuracy, 0) / subjectTracks.length)
            : 60;
        const cinematicMotionScore = Math.round((cinematicBase + metrics.continuity + motionStabilityScore) / 3);
        const productionReadinessScore = Math.round((productionBase + motionQualityScore + trackingAccuracyScore) / 3);
        const aiConfidenceScore = Math.round((motionQualityScore +
            motionStabilityScore +
            trackingAccuracyScore +
            cinematicMotionScore +
            productionReadinessScore) /
            5);
        return {
            motionQualityScore,
            motionStabilityScore,
            trackingAccuracyScore,
            cinematicMotionScore,
            productionReadinessScore,
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isAnalysisValid(scores, objectMotionCount, trackCount, eventCount) {
        const diagnostics = [];
        if (objectMotionCount < 1)
            diagnostics.push("At least 1 object motion analysis required");
        if (trackCount < 1)
            diagnostics.push("At least 1 subject track required");
        if (eventCount < 2)
            diagnostics.push("At least 2 motion events required");
        if (scores.motionQualityScore < 55) {
            diagnostics.push(`Motion quality score ${scores.motionQualityScore} below threshold (55)`);
        }
        if (scores.trackingAccuracyScore < 50) {
            diagnostics.push(`Tracking accuracy ${scores.trackingAccuracyScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=motion-intelligence-scorer.js.map