export class MotionGenerationScorer {
    computeScores(draft, scene, cameraPlan) {
        const motionQualityScore = this.computeMotionQuality(draft, scene);
        const smoothnessScore = this.computeSmoothness(draft.motionTiming);
        const cinematicScore = this.computeCinematic(draft, cameraPlan);
        const physicsConsistencyScore = this.computePhysics(draft);
        const productionReadinessScore = this.computeProductionReadiness(draft, scene, cameraPlan);
        const aiConfidenceScore = Math.round((motionQualityScore + smoothnessScore + cinematicScore + physicsConsistencyScore + productionReadinessScore) / 5);
        return {
            motionQualityScore,
            smoothnessScore,
            cinematicScore,
            physicsConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isPlanValid(scores, draft) {
        const diagnostics = [];
        if (!draft.cameraSynchronization.syncPoints.length) {
            diagnostics.push("Camera synchronization sync points required");
        }
        if (scores.motionQualityScore < 55) {
            diagnostics.push(`Motion quality score ${scores.motionQualityScore} below threshold (55)`);
        }
        if (scores.smoothnessScore < 50) {
            diagnostics.push(`Smoothness score ${scores.smoothnessScore} below threshold (50)`);
        }
        if (scores.cinematicScore < 50) {
            diagnostics.push(`Cinematic score ${scores.cinematicScore} below threshold (50)`);
        }
        if (scores.physicsConsistencyScore < 50) {
            diagnostics.push(`Physics consistency score ${scores.physicsConsistencyScore} below threshold (50)`);
        }
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        if (draft.continuity.issues.length > 0) {
            diagnostics.push(...draft.continuity.issues);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, draft) {
        return scores.productionReadinessScore >= 55 && draft.platformOptimizations.length >= 7;
    }
    isPhysicallyConsistent(scores, draft) {
        return scores.physicsConsistencyScore >= 50 && draft.objectMotion.physicsBasedMotion.length >= 10;
    }
    isCinematicallyConsistent(draft) {
        return (draft.continuity.cameraContinuity &&
            draft.continuity.storyContinuity &&
            draft.continuity.issues.length === 0);
    }
    computeMotionQuality(draft, scene) {
        let score = 45;
        if (draft.cameraSynchronization.syncPoints.length >= 1)
            score += 15;
        if (scene.motionPlanning.subjectMotion)
            score += 15;
        if (draft.characterMotion.gestures.length > 5 || draft.productMotion.showcaseMotion.length > 5)
            score += 15;
        if (draft.storytellingOptimization.marketingMoment)
            score += 10;
        return Math.min(100, score);
    }
    computeSmoothness(timing) {
        let score = 45;
        if (timing.motionAcceleration && timing.motionDeceleration)
            score += 25;
        if (timing.motionSpeed)
            score += 15;
        if (timing.motionDuration)
            score += 15;
        return Math.min(100, score);
    }
    computeCinematic(draft, cameraPlan) {
        let score = 40;
        if (cameraPlan.cinematicallyConsistent)
            score += 20;
        if (draft.cameraSynchronization.cameraMovement)
            score += 20;
        if (draft.continuity.cameraContinuity)
            score += 20;
        return Math.min(100, score);
    }
    computePhysics(draft) {
        let score = 45;
        if (draft.objectMotion.physicsBasedMotion.length >= 10)
            score += 20;
        if (draft.objectMotion.collisionPlanning.length >= 5)
            score += 15;
        if (draft.productMotion.placement.length >= 5)
            score += 20;
        return Math.min(100, score);
    }
    computeProductionReadiness(draft, scene, cameraPlan) {
        let score = 45;
        if (scene.productionReady && cameraPlan.productionReady)
            score += 20;
        if (draft.platformOptimizations.length >= 7)
            score += 15;
        if (draft.motionTiming.motionDuration)
            score += 10;
        if (draft.environmentMotion.activeEffects.length >= 1)
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=motion-generation-scorer.js.map