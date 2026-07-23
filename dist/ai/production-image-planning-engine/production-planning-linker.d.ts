import type { CreativeImageIntelligenceRecord } from "../creative-image-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { ProductionImagePlanningRecord, ProductionImagePlanningRelationships } from "./types.js";
export declare class ProductionPlanningLinker {
    detectRelationships(record: ProductionImagePlanningRecord, allRecords: ProductionImagePlanningRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, enhancementPlan: ImageEnhancementPlanningRecord, creativePlan: CreativeImageIntelligenceRecord, projects?: string[], knowledgeIds?: string[]): ProductionImagePlanningRelationships;
}
//# sourceMappingURL=production-planning-linker.d.ts.map