export class ImageGenerationOptimizationScorer {
    computeScores(component, pipeline, resource, quality, search, performance, context) {
        const optimizationScore = this.computeOptimizationScore(component, pipeline);
        const resourceEfficiencyScore = this.computeResourceScore(resource);
        const qualityImprovementScore = this.computeQualityImprovement(quality, context);
        const performanceScore = this.computePerformanceScore(performance, search);
        const productionReadinessScore = this.computeProductionReadiness(context, component);
        const aiConfidenceScore = Math.round((optimizationScore + resourceEfficiencyScore + qualityImprovementScore + performanceScore + productionReadinessScore) / 5);
        return {
            optimizationScore,
            performanceScore,
            resourceEfficiencyScore,
            qualityImprovementScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isOptimizationValid(scores, record) {
        const diagnostics = [];
        if (scores.optimizationScore < 55)
            diagnostics.push(`Optimization score ${scores.optimizationScore} below threshold (55)`);
        if (scores.performanceScore < 55)
            diagnostics.push(`Performance score ${scores.performanceScore} below threshold (55)`);
        if (scores.resourceEfficiencyScore < 55)
            diagnostics.push(`Resource efficiency score ${scores.resourceEfficiencyScore} below threshold (55)`);
        if (scores.qualityImprovementScore < 55)
            diagnostics.push(`Quality improvement score ${scores.qualityImprovementScore} below threshold (55)`);
        if (scores.productionReadinessScore < 55)
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        if (!record.componentOptimization.creativeDecisionsPreserved) {
            diagnostics.push("Creative decisions must be preserved during optimization");
        }
        if (!record.qualityOptimization.qualityMaintainedOrImproved) {
            diagnostics.push("Quality must be maintained or improved — never reduced for performance");
        }
        if (!record.pipelineOptimization.allPipelineOptimized) {
            diagnostics.push("Pipeline optimization incomplete");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isApproved(scores, record) {
        return (scores.optimizationScore >= 55 &&
            scores.qualityImprovementScore >= 55 &&
            record.qualityOptimization.qualityMaintainedOrImproved &&
            record.componentOptimization.creativeDecisionsPreserved);
    }
    computeOptimizationScore(component, pipeline) {
        const componentFlags = [
            component.promptProcessingOptimized,
            component.textToImageOptimized,
            component.imageToImageOptimized,
            component.productImageOptimized,
            component.backgroundOptimized,
            component.imageEditingOptimized,
            component.enhancementOptimized,
            component.brandingOptimized,
            component.multiStyleOptimized,
            component.productionOptimized,
            component.renderPreparationOptimized,
            component.validationResultsOptimized,
        ];
        const componentRatio = componentFlags.filter(Boolean).length / componentFlags.length;
        let score = Math.round(45 + componentRatio * 40);
        if (pipeline.allPipelineOptimized)
            score += 10;
        if (component.creativeDecisionsPreserved)
            score += 5;
        return Math.min(100, score);
    }
    computeResourceScore(resource) {
        let score = 50;
        if (resource.allResourcesOptimized)
            score += 25;
        if (resource.parallelProcessing)
            score += 10;
        if (resource.cacheUsage.length >= 5)
            score += 10;
        if (resource.backgroundProcessing.length >= 5)
            score += 5;
        return Math.min(100, score);
    }
    computeQualityImprovement(quality, context) {
        let score = 55;
        if (quality.qualityMaintainedOrImproved)
            score += 25;
        if (quality.allQualityOptimized)
            score += 10;
        if (context.validation?.approved)
            score += 10;
        return Math.min(100, score);
    }
    computePerformanceScore(performance, search) {
        let score = 50;
        if (performance.allPerformanceOptimized)
            score += 25;
        if (search.allSearchOptimized)
            score += 15;
        if (performance.scalability.length >= 5)
            score += 10;
        return Math.min(100, score);
    }
    computeProductionReadiness(context, component) {
        let score = 45;
        if (context.validation?.approved)
            score += 20;
        if (context.renderPlan?.renderReady)
            score += 15;
        if (context.productionPlan?.productionReady)
            score += 10;
        if (component.productionOptimized && component.renderPreparationOptimized)
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=image-generation-optimization-scorer.js.map