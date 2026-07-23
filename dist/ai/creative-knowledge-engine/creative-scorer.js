const MIN_STORE_CONFIDENCE = 55;
export class CreativeScorer {
    computeScores(visual, storytelling, animation, cinematic, brandConsistency) {
        const visualDesignScore = Math.round(visual.balance * 0.2 +
            visual.contrast * 0.15 +
            visual.negativeSpace * 0.15 +
            visual.whiteSpace * 0.15 +
            (visual.gridSystem ? 15 : 0) +
            (visual.visualHierarchy ? 15 : 0));
        const storytellingScore = Math.round(storytelling.attentionRetention * 0.35 +
            (storytelling.storyStructure ? 20 : 0) +
            (storytelling.sceneFlow ? 15 : 0) +
            (storytelling.endingStrategy ? 15 : 0) +
            (storytelling.productReveal ? 15 : 0));
        const animationScore = Math.round(animation.animationQuality * 0.4 +
            (animation.motionPrinciples.length >= 2 ? 20 : 8) +
            (animation.timing ? 15 : 0) +
            (animation.logoAnimation ? 15 : 0) +
            (animation.textAnimation ? 10 : 0));
        const brandConsistencyScore = Math.round(brandConsistency);
        const marketingReadinessScore = Math.round(storytellingScore * 0.35 +
            visualDesignScore * 0.3 +
            animationScore * 0.2 +
            brandConsistencyScore * 0.15);
        const creativeQualityScore = Math.round((visualDesignScore + storytellingScore + animationScore + cinematic.visualContinuity) / 4);
        const aiConfidenceScore = Math.round((creativeQualityScore +
            visualDesignScore +
            storytellingScore +
            animationScore +
            brandConsistencyScore +
            marketingReadinessScore) /
            6);
        return {
            creativeQualityScore: Math.min(100, creativeQualityScore),
            visualDesignScore: Math.min(100, visualDesignScore),
            storytellingScore: Math.min(100, storytellingScore),
            animationScore: Math.min(100, animationScore),
            brandConsistencyScore: Math.min(100, brandConsistencyScore),
            marketingReadinessScore: Math.min(100, marketingReadinessScore),
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isAnalysisValid(scores) {
        const diagnostics = [];
        if (scores.aiConfidenceScore < MIN_STORE_CONFIDENCE) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum ${MIN_STORE_CONFIDENCE}`);
        }
        if (scores.creativeQualityScore < 45) {
            diagnostics.push("Creative quality score too low for validated storage");
        }
        const minDimension = 50;
        if (scores.visualDesignScore < minDimension) {
            diagnostics.push(`Visual design ${scores.visualDesignScore} below minimum ${minDimension}`);
        }
        if (scores.storytellingScore < minDimension) {
            diagnostics.push(`Storytelling ${scores.storytellingScore} below minimum ${minDimension}`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=creative-scorer.js.map