import type { QualityPredictionRecord } from "../quality-prediction-engine/types.js";
import type { ProductionPlanningRecord } from "../production-planning-engine/types.js";
import { ProductIntelligenceOptimizationRecord, ProductIntelligenceOptimizationRelationships } from "./types.js";
export declare class ProductIntelligenceOptimizationLinker {
    detectRelationships(record: ProductIntelligenceOptimizationRecord, qualityPrediction: QualityPredictionRecord, productionPlan: ProductionPlanningRecord): ProductIntelligenceOptimizationRelationships;
}
//# sourceMappingURL=product-intelligence-optimization-linker.d.ts.map