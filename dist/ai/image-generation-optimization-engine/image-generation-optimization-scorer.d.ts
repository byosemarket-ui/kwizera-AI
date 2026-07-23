import { ComponentOptimizationPlan, ImageGenerationOptimizationRecord, OptimizationScores, PerformanceOptimizationPlan, PipelineOptimizationPlan, QualityOptimizationPlan, ResourceOptimizationPlan, SearchOptimizationPlan } from "./types.js";
import type { OptimizationContext } from "./image-generation-optimization-analyzer.js";
export declare class ImageGenerationOptimizationScorer {
    computeScores(component: ComponentOptimizationPlan, pipeline: PipelineOptimizationPlan, resource: ResourceOptimizationPlan, quality: QualityOptimizationPlan, search: SearchOptimizationPlan, performance: PerformanceOptimizationPlan, context: OptimizationContext): OptimizationScores;
    isOptimizationValid(scores: OptimizationScores, record: Pick<ImageGenerationOptimizationRecord, "componentOptimization" | "pipelineOptimization" | "qualityOptimization">): {
        valid: boolean;
        diagnostics: string[];
    };
    isApproved(scores: OptimizationScores, record: Pick<ImageGenerationOptimizationRecord, "qualityOptimization" | "componentOptimization">): boolean;
    private computeOptimizationScore;
    private computeResourceScore;
    private computeQualityImprovement;
    private computePerformanceScore;
    private computeProductionReadiness;
}
//# sourceMappingURL=image-generation-optimization-scorer.d.ts.map