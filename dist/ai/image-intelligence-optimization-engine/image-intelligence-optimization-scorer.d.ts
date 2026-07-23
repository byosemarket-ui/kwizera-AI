import type { ImageQualityPredictionRecord } from "../image-quality-prediction-engine/types.js";
import { ImageModuleOptimizationResult, ImageOptimizationPerformanceMetrics, ImageOptimizationScores } from "./types.js";
export declare class ImageIntelligenceOptimizationScorer {
    computeScores(moduleResults: ImageModuleOptimizationResult[], performance: ImageOptimizationPerformanceMetrics, qualityPrediction: ImageQualityPredictionRecord): ImageOptimizationScores;
    isOptimizationValid(scores: ImageOptimizationScores, moduleResults: ImageModuleOptimizationResult[], qualityPreserved: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: ImageOptimizationScores, qualityPrediction: ImageQualityPredictionRecord, qualityPreserved: boolean): boolean;
}
//# sourceMappingURL=image-intelligence-optimization-scorer.d.ts.map