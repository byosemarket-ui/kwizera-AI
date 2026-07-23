export class CameraDirectorScorer {
    computeScores(draft, scene) {
        const cameraDirectionScore = this.computeDirectionScore(draft.shotPlans, scene);
        const cinematicScore = this.computeCinematicScore(draft.shotPlans, draft.continuity);
        const compositionScore = this.computeCompositionScore(draft.compositionPlanning);
        const storytellingScore = this.computeStorytellingScore(scene, draft.shotPlans);
        const productionReadinessScore = this.computeProductionReadiness(draft, scene);
        const aiConfidenceScore = Math.round((cameraDirectionScore + cinematicScore + compositionScore + storytellingScore + productionReadinessScore) / 5);
        return {
            cameraDirectionScore,
            cinematicScore,
            compositionScore,
            storytellingScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isPlanValid(scores, draft) {
        const diagnostics = [];
        if (draft.shotPlans.length < 1)
            diagnostics.push("Camera plan must include at least one shot");
        if (scores.cameraDirectionScore < 55) {
            diagnostics.push(`Camera direction score ${scores.cameraDirectionScore} below threshold (55)`);
        }
        if (scores.cinematicScore < 50) {
            diagnostics.push(`Cinematic score ${scores.cinematicScore} below threshold (50)`);
        }
        if (scores.compositionScore < 50) {
            diagnostics.push(`Composition score ${scores.compositionScore} below threshold (50)`);
        }
        if (scores.storytellingScore < 50) {
            diagnostics.push(`Storytelling score ${scores.storytellingScore} below threshold (50)`);
        }
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        if (!draft.focusPlanning.focusSubject)
            diagnostics.push("Focus subject required");
        if (!draft.compositionPlanning.primaryStrategy)
            diagnostics.push("Composition strategy required");
        if (draft.continuity.issues.length > 0) {
            diagnostics.push(...draft.continuity.issues);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, draft) {
        return (draft.shotPlans.length >= 1 &&
            scores.productionReadinessScore >= 55 &&
            draft.platformOptimizations.length >= 7);
    }
    isBrandConsistent(scores, scene) {
        return scores.compositionScore >= 50 && scene.brandConsistent;
    }
    isCinematicallyConsistent(continuity) {
        return (continuity.cameraConsistency &&
            continuity.motionContinuity &&
            continuity.storyContinuity &&
            continuity.issues.length === 0);
    }
    computeDirectionScore(shots, scene) {
        let score = 45;
        if (shots.every((s) => s.cameraAngle && s.cameraMovement && s.framing))
            score += 20;
        if (shots.length >= scene.shots.length)
            score += 15;
        if (shots.some((s) => s.marketingPurpose.length >= 10))
            score += 20;
        return Math.min(100, score);
    }
    computeCinematicScore(shots, continuity) {
        let score = 40;
        if (shots.length >= 2)
            score += 15;
        if (continuity.cameraConsistency)
            score += 15;
        if (continuity.motionContinuity)
            score += 15;
        if (continuity.lightingContinuity)
            score += 15;
        return Math.min(100, score);
    }
    computeCompositionScore(composition) {
        let score = 45;
        if (composition.ruleOfThirds && composition.productHighlight)
            score += 20;
        if (composition.brandVisibility && composition.negativeSpace)
            score += 20;
        if (composition.primaryStrategy)
            score += 15;
        return Math.min(100, score);
    }
    computeStorytellingScore(scene, shots) {
        let score = 45;
        if (scene.structure.sceneObjectives.length >= 1)
            score += 15;
        if (shots.some((s) => s.shotType.includes("establishing") || s.shotType.includes("hero")))
            score += 20;
        if (scene.structure.scenePurpose)
            score += 20;
        return Math.min(100, score);
    }
    computeProductionReadiness(draft, scene) {
        let score = 45;
        if (draft.focusPlanning.depthOfField && draft.focusPlanning.focusSubject)
            score += 15;
        if (draft.platformOptimizations.length >= 7)
            score += 15;
        if (scene.productionReady)
            score += 15;
        if (draft.shotPlans.every((s) => s.duration))
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=camera-director-scorer.js.map