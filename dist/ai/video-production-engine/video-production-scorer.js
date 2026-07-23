export class VideoProductionScorer {
    computeScores(draft, storyboard, upstream) {
        const productionReadinessScore = this.computeProductionReadiness(draft, storyboard);
        const assetReadinessScore = this.computeAssetReadiness(draft);
        const workflowScore = this.computeWorkflow(draft);
        const timelineScore = this.computeTimeline(draft);
        const dependencyScore = this.computeDependency(draft);
        const performanceScore = this.computePerformance(draft);
        const aiConfidenceScore = Math.round((productionReadinessScore + assetReadinessScore + workflowScore + timelineScore + dependencyScore + performanceScore) / 6);
        return {
            productionReadinessScore,
            assetReadinessScore,
            workflowScore,
            timelineScore,
            dependencyScore,
            performanceScore,
            aiConfidenceScore,
        };
    }
    isPlanValid(scores, draft) {
        const diagnostics = [];
        if (!draft.workflowValidation.productionWorkflowValidated) {
            diagnostics.push(`Workflow validation failed: ${draft.workflowValidation.issues.join("; ")}`);
        }
        if (!draft.dependencyValidation.allDependenciesReady) {
            diagnostics.push(`Missing dependencies: ${draft.dependencyValidation.missingDependencies.join(", ")}`);
        }
        if (!draft.assetValidation.allAssetsReady)
            diagnostics.push("Asset validation incomplete");
        if (draft.productionTimeline.renderingTimeline.length < 3)
            diagnostics.push("Rendering timeline incomplete");
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.assetReadinessScore < 50) {
            diagnostics.push(`Asset readiness score ${scores.assetReadinessScore} below threshold (50)`);
        }
        if (scores.workflowScore < 50) {
            diagnostics.push(`Workflow score ${scores.workflowScore} below threshold (50)`);
        }
        if (scores.timelineScore < 50) {
            diagnostics.push(`Timeline score ${scores.timelineScore} below threshold (50)`);
        }
        if (scores.dependencyScore < 50) {
            diagnostics.push(`Dependency score ${scores.dependencyScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, draft) {
        return scores.productionReadinessScore >= 55 && draft.platformOptimizations.length >= 8;
    }
    isBrandConsistent(storyboard, upstream) {
        return (storyboard.brandConsistent &&
            upstream.marketingPlan.brandConsistent &&
            upstream.scenes.every((s) => s.brandConsistent));
    }
    computeProductionReadiness(draft, storyboard) {
        let score = 45;
        if (draft.workflowValidation.productionWorkflowValidated)
            score += 25;
        if (storyboard.productionReady)
            score += 15;
        if (draft.renderPreparation.resolution.length > 3)
            score += 15;
        return Math.min(100, score);
    }
    computeAssetReadiness(draft) {
        let score = 45;
        if (draft.assetValidation.allAssetsReady)
            score += 30;
        if (draft.assetValidation.logos.length > 3)
            score += 15;
        if (draft.assetValidation.voice.length > 3)
            score += 10;
        return Math.min(100, score);
    }
    computeWorkflow(draft) {
        let score = 40;
        if (draft.workflowValidation.storyboardValidated)
            score += 10;
        if (draft.workflowValidation.marketingPlansValidated)
            score += 10;
        if (draft.workflowValidation.audioSyncPlansValidated)
            score += 10;
        if (draft.productionWorkflow.validationGates.length >= 4)
            score += 20;
        if (draft.workflowValidation.productionWorkflowValidated)
            score += 10;
        return Math.min(100, score);
    }
    computeTimeline(draft) {
        let score = 45;
        if (draft.productionTimeline.sceneTimeline.length >= 1)
            score += 15;
        if (draft.productionTimeline.audioTimeline.length >= 1)
            score += 15;
        if (draft.productionTimeline.renderingTimeline.length >= 4)
            score += 15;
        if (draft.productionTimeline.effectsTimeline.length >= 1)
            score += 10;
        return Math.min(100, score);
    }
    computeDependency(draft) {
        if (draft.dependencyValidation.allDependenciesReady)
            return 100;
        const total = 14;
        const ready = total - draft.dependencyValidation.missingDependencies.length;
        return Math.max(0, Math.round((ready / total) * 100));
    }
    computePerformance(draft) {
        let score = 70;
        if (draft.exportPreparation.formats.length >= 5)
            score += 15;
        if (draft.recoveryPlan.rollbackPoints.length >= 2)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=video-production-scorer.js.map