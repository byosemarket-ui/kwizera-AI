import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { CreativeVideoIntelligenceRecord } from "../creative-video-intelligence-engine/types.js";
import { ProductionVideoPlanningRecord, ProductionVideoPlanningRelationships } from "./types.js";
export declare class ProductionVideoLinker {
    detectRelationships(record: ProductionVideoPlanningRecord, allRecords: ProductionVideoPlanningRecord[], analysis: VideoAnalysisIntelligenceRecord, understanding: VideoUnderstandingRecord, enhancementPlan: VideoEnhancementPlanRecord, creativePlan: CreativeVideoIntelligenceRecord, projects?: string[], knowledgeIds?: string[], scriptIds?: string[]): ProductionVideoPlanningRelationships;
}
//# sourceMappingURL=production-video-linker.d.ts.map