import type { CreativeImageIntelligenceRecord } from "../creative-image-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ProductionImagePlanningRecord } from "../production-image-planning-engine/types.js";
import { ImageQualityPredictionRecord, ImageQualityPredictionRelationships } from "./types.js";
export declare class ImageQualityPredictionLinker {
    detectRelationships(record: ImageQualityPredictionRecord, allRecords: ImageQualityPredictionRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, productionPlan: ProductionImagePlanningRecord, creativePlan: CreativeImageIntelligenceRecord, enhancementPlan: ImageEnhancementPlanningRecord, projects?: string[], knowledgeIds?: string[]): ImageQualityPredictionRelationships;
}
//# sourceMappingURL=image-quality-prediction-linker.d.ts.map