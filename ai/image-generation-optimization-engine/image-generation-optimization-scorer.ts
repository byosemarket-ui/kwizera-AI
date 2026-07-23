import {
  ComponentOptimizationPlan,
  ImageGenerationOptimizationRecord,
  OptimizationScores,
  PerformanceOptimizationPlan,
  PipelineOptimizationPlan,
  QualityOptimizationPlan,
  ResourceOptimizationPlan,
  SearchOptimizationPlan,
} from "./types.js";
import type { OptimizationContext } from "./image-generation-optimization-analyzer.js";

export class ImageGenerationOptimizationScorer {
  computeScores(
    component: ComponentOptimizationPlan,
    pipeline: PipelineOptimizationPlan,
    resource: ResourceOptimizationPlan,
    quality: QualityOptimizationPlan,
    search: SearchOptimizationPlan,
    performance: PerformanceOptimizationPlan,
    context: OptimizationContext
  ): OptimizationScores {
    const optimizationScore = this.computeOptimizationScore(component, pipeline);
    const resourceEfficiencyScore = this.computeResourceScore(resource);
    const qualityImprovementScore = this.computeQualityImprovement(quality, context);
    const performanceScore = this.computePerformanceScore(performance, search);
    const productionReadinessScore = this.computeProductionReadiness(context, component);
    const aiConfidenceScore = Math.round(
      (optimizationScore + resourceEfficiencyScore + qualityImprovementScore + performanceScore + productionReadinessScore) / 5
    );

    return {
      optimizationScore,
      performanceScore,
      resourceEfficiencyScore,
      qualityImprovementScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isOptimizationValid(
    scores: OptimizationScores,
    record: Pick<
      ImageGenerationOptimizationRecord,
      "componentOptimization" | "pipelineOptimization" | "qualityOptimization"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.optimizationScore < 55) diagnostics.push(`Optimization score ${scores.optimizationScore} below threshold (55)`);
    if (scores.performanceScore < 55) diagnostics.push(`Performance score ${scores.performanceScore} below threshold (55)`);
    if (scores.resourceEfficiencyScore < 55) diagnostics.push(`Resource efficiency score ${scores.resourceEfficiencyScore} below threshold (55)`);
    if (scores.qualityImprovementScore < 55) diagnostics.push(`Quality improvement score ${scores.qualityImprovementScore} below threshold (55)`);
    if (scores.productionReadinessScore < 55) diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    if (scores.aiConfidenceScore < 55) diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);

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

  isApproved(scores: OptimizationScores, record: Pick<ImageGenerationOptimizationRecord, "qualityOptimization" | "componentOptimization">): boolean {
    return (
      scores.optimizationScore >= 55 &&
      scores.qualityImprovementScore >= 55 &&
      record.qualityOptimization.qualityMaintainedOrImproved &&
      record.componentOptimization.creativeDecisionsPreserved
    );
  }

  private computeOptimizationScore(component: ComponentOptimizationPlan, pipeline: PipelineOptimizationPlan): number {
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
    if (pipeline.allPipelineOptimized) score += 10;
    if (component.creativeDecisionsPreserved) score += 5;
    return Math.min(100, score);
  }

  private computeResourceScore(resource: ResourceOptimizationPlan): number {
    let score = 50;
    if (resource.allResourcesOptimized) score += 25;
    if (resource.parallelProcessing) score += 10;
    if (resource.cacheUsage.length >= 5) score += 10;
    if (resource.backgroundProcessing.length >= 5) score += 5;
    return Math.min(100, score);
  }

  private computeQualityImprovement(quality: QualityOptimizationPlan, context: OptimizationContext): number {
    let score = 55;
    if (quality.qualityMaintainedOrImproved) score += 25;
    if (quality.allQualityOptimized) score += 10;
    if (context.validation?.approved) score += 10;
    return Math.min(100, score);
  }

  private computePerformanceScore(performance: PerformanceOptimizationPlan, search: SearchOptimizationPlan): number {
    let score = 50;
    if (performance.allPerformanceOptimized) score += 25;
    if (search.allSearchOptimized) score += 15;
    if (performance.scalability.length >= 5) score += 10;
    return Math.min(100, score);
  }

  private computeProductionReadiness(context: OptimizationContext, component: ComponentOptimizationPlan): number {
    let score = 45;
    if (context.validation?.approved) score += 20;
    if (context.renderPlan?.renderReady) score += 15;
    if (context.productionPlan?.productionReady) score += 10;
    if (component.productionOptimized && component.renderPreparationOptimized) score += 10;
    return Math.min(100, score);
  }
}
