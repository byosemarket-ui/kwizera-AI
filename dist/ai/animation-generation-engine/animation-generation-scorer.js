export class AnimationGenerationScorer {
    computeScores(draft, scene, motionPlan, cameraPlan) {
        const animationQualityScore = this.computeQuality(draft, scene);
        const smoothnessScore = this.computeSmoothness(draft.timeline);
        const visualAppealScore = this.computeVisualAppeal(draft);
        const synchronizationScore = this.computeSync(draft.synchronization);
        const productionReadinessScore = this.computeProductionReadiness(draft, scene, motionPlan, cameraPlan);
        const aiConfidenceScore = Math.round((animationQualityScore + smoothnessScore + visualAppealScore + synchronizationScore + productionReadinessScore) / 5);
        return {
            animationQualityScore,
            smoothnessScore,
            visualAppealScore,
            synchronizationScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isPlanValid(scores, draft) {
        const diagnostics = [];
        if (!draft.timeline.animationDuration)
            diagnostics.push("Animation duration required");
        if (draft.synchronization.motionSync.length < 1)
            diagnostics.push("Motion synchronization required");
        if (scores.animationQualityScore < 55) {
            diagnostics.push(`Animation quality score ${scores.animationQualityScore} below threshold (55)`);
        }
        if (scores.smoothnessScore < 50) {
            diagnostics.push(`Smoothness score ${scores.smoothnessScore} below threshold (50)`);
        }
        if (scores.visualAppealScore < 50) {
            diagnostics.push(`Visual appeal score ${scores.visualAppealScore} below threshold (50)`);
        }
        if (scores.synchronizationScore < 50) {
            diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (50)`);
        }
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, draft) {
        return scores.productionReadinessScore >= 55 && draft.platformOptimizations.length >= 7;
    }
    isBrandConsistent(scene) {
        return scene.brandConsistent;
    }
    isSmooth(scores, draft) {
        return scores.smoothnessScore >= 50 && draft.timeline.easing.length >= 10;
    }
    computeQuality(draft, scene) {
        let score = 45;
        if (draft.characterAnimation.gesture.length > 3)
            score += 10;
        if (draft.productAnimation.reveal.length > 5)
            score += 10;
        if (draft.textAnimation.reveal.length > 5)
            score += 10;
        if (draft.transitionAnimation.dissolve.length > 3)
            score += 10;
        if (scene.structure.sceneObjectives.length >= 1)
            score += 15;
        return Math.min(100, score);
    }
    computeSmoothness(timeline) {
        let score = 45;
        if (timeline.easing)
            score += 25;
        if (timeline.animationDuration)
            score += 15;
        if (timeline.layerPriority.length >= 4)
            score += 15;
        return Math.min(100, score);
    }
    computeVisualAppeal(draft) {
        let score = 45;
        if (draft.logoAnimation.logoReveal.length > 5)
            score += 15;
        if (draft.environmentAnimation.particles.length > 3)
            score += 15;
        if (draft.textAnimation.kineticTypography.length > 5)
            score += 15;
        if (draft.productAnimation.showcase.length > 5)
            score += 10;
        return Math.min(100, score);
    }
    computeSync(sync) {
        let score = 40;
        if (sync.motionSync.length >= 1)
            score += 20;
        if (sync.cameraSync.length >= 1)
            score += 20;
        if (sync.audioSync.length >= 1)
            score += 20;
        return Math.min(100, score);
    }
    computeProductionReadiness(draft, scene, motionPlan, cameraPlan) {
        let score = 45;
        if (scene.productionReady && motionPlan.productionReady && cameraPlan.productionReady)
            score += 25;
        if (draft.platformOptimizations.length >= 7)
            score += 15;
        if (draft.timeline.layerPriority.length >= 5)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=animation-generation-scorer.js.map