import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import type { ImageQualityPredictionRecord } from "../image-quality-prediction-engine/types.js";
import type { ProductionImagePlanningRecord } from "../production-image-planning-engine/types.js";
import { ImageCacheOptimization, ImageIntelligenceOptimizationInput, ImageIntelligenceRecoveryPoint, ImageModuleOptimizationResult, ImageOptimizationPerformanceMetrics, ImageOptimizationProfile, ImageOptimizationStrategies } from "./types.js";
export declare class ImageIntelligenceOptimizationAnalyzer {
    buildProfile(input: ImageIntelligenceOptimizationInput, qualityPrediction: ImageQualityPredictionRecord, productionPlan: ProductionImagePlanningRecord, version: number): ImageOptimizationProfile;
    collectBaselineMetrics(foundation: AiImageIntelligenceFoundation): Record<string, number>;
    createRecoveryPoint(optimizationId: string, baseline: Record<string, number>, cache: ImageCacheOptimization): ImageIntelligenceRecoveryPoint;
    analyzeModuleOptimizations(foundation: AiImageIntelligenceFoundation, baseline: Record<string, number>): ImageModuleOptimizationResult[];
    buildStrategies(moduleResults: ImageModuleOptimizationResult[]): ImageOptimizationStrategies;
    buildCacheOptimization(foundation: AiImageIntelligenceFoundation, imageId: string, existingCache: ImageCacheOptimization): ImageCacheOptimization;
    measurePerformance(foundation: AiImageIntelligenceFoundation, baseline: Record<string, number>): ImageOptimizationPerformanceMetrics;
    validateQualityPreserved(moduleResults: ImageModuleOptimizationResult[]): {
        valid: boolean;
        issues: string[];
    };
}
//# sourceMappingURL=image-intelligence-optimization-analyzer.d.ts.map