export class VideoStyleScorer {
    computeScores(visual, editing, brand, cinematicScoreBase, marketingBase, templateMatchScore) {
        let styleConsistencyScore = 55;
        if (brand.visualConsistency >= 70)
            styleConsistencyScore += 15;
        if (brand.visualConsistency >= 85)
            styleConsistencyScore += 10;
        if (visual.visualIdentity.length > 10)
            styleConsistencyScore += 5;
        styleConsistencyScore = Math.min(100, styleConsistencyScore);
        const cinematicScore = Math.min(100, Math.round((cinematicScoreBase + templateMatchScore) / 2));
        let brandStyleScore = Math.round(brand.visualConsistency * 0.7 + (brand.brandColors.length >= 2 ? 20 : 10));
        brandStyleScore = Math.min(100, brandStyleScore);
        let editingQualityScore = 60;
        if (editing.pacing)
            editingQualityScore += 10;
        if (editing.audioSyncStyle.includes("sync"))
            editingQualityScore += 10;
        if (editing.editingRhythm)
            editingQualityScore += 10;
        editingQualityScore = Math.min(100, editingQualityScore);
        const marketingReadinessScore = Math.round((marketingBase + brandStyleScore + styleConsistencyScore) / 3);
        const aiConfidenceScore = Math.round((styleConsistencyScore +
            cinematicScore +
            brandStyleScore +
            editingQualityScore +
            marketingReadinessScore) /
            5);
        return {
            styleConsistencyScore,
            cinematicScore,
            brandStyleScore,
            editingQualityScore,
            marketingReadinessScore,
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isAnalysisValid(scores, cinematicStyleCount, templateCount) {
        const diagnostics = [];
        if (cinematicStyleCount < 1)
            diagnostics.push("At least 1 cinematic style classification required");
        if (templateCount < 1)
            diagnostics.push("At least 1 style template match required");
        if (scores.styleConsistencyScore < 55) {
            diagnostics.push(`Style consistency ${scores.styleConsistencyScore} below threshold (55)`);
        }
        if (scores.brandStyleScore < 50) {
            diagnostics.push(`Brand style score ${scores.brandStyleScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=video-style-scorer.js.map