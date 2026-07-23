const MIN_STORE_CONFIDENCE = 55;
export class VideoScorer {
    computeScores(structure, editing, audio, marketing, visual) {
        const sceneCount = structure.sceneSequence.length;
        const avgProductVisibility = structure.sceneSequence.reduce((s, sc) => s + sc.productVisibility, 0) / Math.max(sceneCount, 1);
        const hasCta = structure.sceneSequence.some((s) => s.ctaPlacement !== "none");
        const storytellingScore = Math.round((sceneCount >= 3 ? 25 : 10) +
            (structure.storyFlow.includes("hook") ? 20 : 10) +
            (structure.intro ? 15 : 0) +
            (structure.outro ? 15 : 0) +
            Math.min(avgProductVisibility * 0.25, 25));
        const editingScore = Math.round(editing.motionConsistency * 0.3 +
            editing.visualContinuity * 0.3 +
            (editing.transitionTechniques.length >= 2 ? 20 : 10) +
            (editing.editingRhythm ? 10 : 0));
        const marketingScore = Math.round(marketing.customerAttention * 0.3 +
            (marketing.hookTiming <= 5 ? 20 : 10) +
            (hasCta ? 20 : 5) +
            (marketing.valueProposition ? 15 : 0) +
            (marketing.closingStrategy ? 15 : 0));
        const visualScore = Math.round(visual.brandingConsistency * 0.35 +
            (visual.colorGrading ? 15 : 0) +
            (visual.motionGraphics ? 15 : 0) +
            (visual.logoAnimation ? 15 : 0) +
            avgProductVisibility * 0.2);
        const audioScore = Math.round(audio.audioQuality * 0.35 +
            audio.audioBalance * 0.25 +
            audio.beatSynchronization * 0.25 +
            (audio.backgroundMusic ? 15 : 0));
        const brandConsistencyScore = Math.round(visual.brandingConsistency * 0.6 + (visual.logoAnimation ? 20 : 0) + (structure.intro ? 10 : 0));
        const aiConfidenceScore = Math.round((storytellingScore + editingScore + marketingScore + visualScore + audioScore + brandConsistencyScore) / 6);
        return {
            storytellingScore: Math.min(100, storytellingScore),
            editingScore: Math.min(100, editingScore),
            marketingScore: Math.min(100, marketingScore),
            visualScore: Math.min(100, visualScore),
            audioScore: Math.min(100, audioScore),
            brandConsistencyScore: Math.min(100, brandConsistencyScore),
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isAnalysisValid(scores) {
        const diagnostics = [];
        if (scores.aiConfidenceScore < MIN_STORE_CONFIDENCE) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum ${MIN_STORE_CONFIDENCE}`);
        }
        if (scores.storytellingScore < 35) {
            diagnostics.push("Storytelling score too low for validated storage");
        }
        const minDimension = 50;
        if (scores.editingScore < minDimension) {
            diagnostics.push(`Editing score ${scores.editingScore} below minimum ${minDimension}`);
        }
        if (scores.audioScore < minDimension) {
            diagnostics.push(`Audio score ${scores.audioScore} below minimum ${minDimension}`);
        }
        if (scores.visualScore < minDimension) {
            diagnostics.push(`Visual score ${scores.visualScore} below minimum ${minDimension}`);
        }
        if (scores.marketingScore < minDimension) {
            diagnostics.push(`Marketing score ${scores.marketingScore} below minimum ${minDimension}`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=video-scorer.js.map