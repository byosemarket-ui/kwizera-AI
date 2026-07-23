import type { ImageQualityPredictionRecord } from "../image-quality-prediction-engine/types.js";
import type { ProductionImagePlanningRecord } from "../production-image-planning-engine/types.js";
import { ImageIntelligenceOptimizationRecord, ImageIntelligenceOptimizationRelationships } from "./types.js";
export declare class ImageIntelligenceOptimizationLinker {
    detectRelationships(record: ImageIntelligenceOptimizationRecord, qualityPrediction: ImageQualityPredictionRecord, productionPlan: ProductionImagePlanningRecord): ImageIntelligenceOptimizationRelationships;
}
//# sourceMappingURL=image-intelligence-optimization-linker.d.ts.map