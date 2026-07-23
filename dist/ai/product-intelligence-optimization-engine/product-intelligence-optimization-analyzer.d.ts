import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import type { QualityPredictionRecord } from "../quality-prediction-engine/types.js";
import type { ProductionPlanningRecord } from "../production-planning-engine/types.js";
import { CacheOptimization, ModuleOptimizationResult, OptimizationProfile, OptimizationStrategies, PerformanceMetrics, ProductIntelligenceOptimizationInput, ProductIntelligenceRecoveryPoint } from "./types.js";
export declare class ProductIntelligenceOptimizationAnalyzer {
    buildProfile(input: ProductIntelligenceOptimizationInput, qualityPrediction: QualityPredictionRecord, productionPlan: ProductionPlanningRecord, version: number): OptimizationProfile;
    collectBaselineMetrics(foundation: AiProductIntelligenceFoundation): Record<string, number>;
    createRecoveryPoint(optimizationId: string, baseline: Record<string, number>, cache: CacheOptimization): ProductIntelligenceRecoveryPoint;
    analyzeModuleOptimizations(foundation: AiProductIntelligenceFoundation, baseline: Record<string, number>): ModuleOptimizationResult[];
    buildStrategies(moduleResults: ModuleOptimizationResult[]): OptimizationStrategies;
    buildCacheOptimization(foundation: AiProductIntelligenceFoundation, productId: string, existingCache: CacheOptimization): CacheOptimization;
    measurePerformance(foundation: AiProductIntelligenceFoundation, baseline: Record<string, number>): PerformanceMetrics;
    validateQualityPreserved(moduleResults: ModuleOptimizationResult[]): {
        valid: boolean;
        issues: string[];
    };
}
//# sourceMappingURL=product-intelligence-optimization-analyzer.d.ts.map