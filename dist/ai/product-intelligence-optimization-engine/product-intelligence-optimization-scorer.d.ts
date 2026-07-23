import type { QualityPredictionRecord } from "../quality-prediction-engine/types.js";
import { ModuleOptimizationResult, OptimizationScores, PerformanceMetrics } from "./types.js";
export declare class ProductIntelligenceOptimizationScorer {
    computeScores(moduleResults: ModuleOptimizationResult[], performance: PerformanceMetrics, qualityPrediction: QualityPredictionRecord): OptimizationScores;
    isOptimizationValid(scores: OptimizationScores, moduleResults: ModuleOptimizationResult[], qualityPreserved: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: OptimizationScores, qualityPrediction: QualityPredictionRecord, qualityPreserved: boolean): boolean;
}
//# sourceMappingURL=product-intelligence-optimization-scorer.d.ts.map