export class VideoGenerationOptimizationScorer {
    computeScores(draft, storyboard, upstream) {
        const optimizationScore = this.computeOptimizationScore(draft);
        const performanceScore = this.computePerformanceScore(draft);
        const resourceEfficiencyScore = this.computeResourceEfficiency(draft);
        const qualityImprovementScore = this.computeQualityImprovement(draft, upstream);
        const productionReadinessScore = this.computeProductionReadiness(draft, upstream);
        const aiConfidenceScore = Math.round((optimizationScore + performanceScore + resourceEfficiencyScore + qualityImprovementScore + productionReadinessScore) / 5);
        return {
            optimizationScore,
            performanceScore,
            resourceEfficiencyScore,
            qualityImprovementScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isOptimizationValid(scores, draft) {
        const diagnostics = [];
        if (!draft.pipelineOptimization.allPipelineOptimized) {
            diagnostics.push("Pipeline optimization incomplete");
        }
        if (!draft.pipelineOptimization.creativeDecisionsPreserved) {
            diagnostics.push("Creative decisions must be preserved during optimization");
        }
        if (!draft.resourceOptimization.allResourcesOptimized) {
            diagnostics.push("Resource optimization incomplete");
        }
        if (!draft.qualityOptimization.allQualityOptimized) {
            diagnostics.push("Quality optimization incomplete — quality must not be reduced");
        }
        if (!draft.qualityOptimization.qualityMaintainedOrImproved) {
            diagnostics.push("Quality must be maintained or improved — never reduced for performance");
        }
        if (!draft.searchOptimization.allSearchOptimized) {
            diagnostics.push("Search optimization incomplete");
        }
        if (!draft.recoveryOptimization.allRecoveryOptimized) {
            diagnostics.push("Recovery optimization incomplete");
        }
        if (!draft.performanceOptimization.allPerformanceOptimized) {
            diagnostics.push("Performance optimization incomplete");
        }
        if (!draft.dependencyValidation.allDependenciesReady) {
            diagnostics.push(`Missing dependencies: ${draft.dependencyValidation.missingDependencies.join(", ")}`);
        }
        if (scores.optimizationScore < 55) {
            diagnostics.push(`Optimization score ${scores.optimizationScore} below threshold (55)`);
        }
        if (scores.qualityImprovementScore < 50) {
            diagnostics.push(`Quality improvement score ${scores.qualityImprovementScore} below threshold (50)`);
        }
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isApproved(scores, draft) {
        return (scores.optimizationScore >= 55 &&
            scores.productionReadinessScore >= 55 &&
            draft.pipelineOptimization.creativeDecisionsPreserved &&
            draft.qualityOptimization.qualityMaintainedOrImproved &&
            draft.componentOptimization.validationResultsOptimized);
    }
    isBrandConsistent(storyboard, upstream) {
        return (storyboard.brandConsistent &&
            upstream.marketingPlan.brandConsistent &&
            upstream.productionPlan.brandConsistent &&
            upstream.renderPlan.brandConsistent &&
            upstream.validationReport.brandConsistent &&
            upstream.scenes.every((s) => s.brandConsistent));
    }
    computeOptimizationScore(draft) {
        let score = 45;
        if (draft.pipelineOptimization.allPipelineOptimized)
            score += 20;
        if (draft.componentOptimization.storyboardOptimized)
            score += 10;
        if (draft.componentOptimization.renderPreparationOptimized)
            score += 15;
        if (draft.searchOptimization.allSearchOptimized)
            score += 10;
        return Math.min(100, score);
    }
    computePerformanceScore(draft) {
        let score = 50;
        if (draft.performanceOptimization.allPerformanceOptimized)
            score += 30;
        if (draft.performanceOptimization.scalability.length > 5)
            score += 20;
        return Math.min(100, score);
    }
    computeResourceEfficiency(draft) {
        let score = 50;
        if (draft.resourceOptimization.allResourcesOptimized)
            score += 35;
        if (draft.resourceOptimization.parallelProcessing.includes("parallel"))
            score += 15;
        return Math.min(100, score);
    }
    computeQualityImprovement(draft, upstream) {
        let score = 50;
        if (draft.qualityOptimization.qualityMaintainedOrImproved)
            score += 30;
        if (upstream.validationReport.approved)
            score += 20;
        return Math.min(100, score);
    }
    computeProductionReadiness(draft, upstream) {
        let score = 45;
        if (upstream.validationReport.approved)
            score += 25;
        if (upstream.renderPlan.renderReady)
            score += 15;
        if (draft.recoveryOptimization.allRecoveryOptimized)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=video-generation-optimization-scorer.js.map